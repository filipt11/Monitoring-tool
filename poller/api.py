"""FastAPI application for network device discovery and inventory management.

The poller API registers Cisco and Juniper devices in PostgreSQL after
validating connectivity and retrieving hostname, model, and interface
inventory from vendor-specific HTTP endpoints (RESTCONF for Cisco, RPC for
Juniper). A background polling loop in :mod:`poller.main` reads the same
database and writes metrics to InfluxDB.

Configuration:
    API listen port is defined by :data:`~poller.config.API_PORT` (default
    ``8000``). PostgreSQL and InfluxDB connection settings live in
    :mod:`poller.config`.

Attributes:
    app (fastapi.FastAPI): Root FastAPI application instance with pagination
        enabled via ``fastapi-pagination``.
    app_lifespan_data (dict): Mutable store populated during application
        lifespan. Key ``"http_client"`` holds a shared
        :class:`httpx.AsyncClient` used for device HTTP calls.
"""

from .config import (
    Session,
    init_db,
    API_PORT,
)
from loguru import logger
from .models import Device, DeviceCreate, DeviceOut, DeviceUpdate, Interface, InterfaceOut, utc_now
from fastapi import FastAPI, HTTPException, status
import uvicorn
from .cisco_polling import fetch_cisco_data_async
from .juniper_polling import fetch_juniper_data_async
from .interface_discovery import discover_device_interfaces_async, sync_device_interfaces
from sys import stderr
from sqlalchemy.exc import IntegrityError
from fastapi_pagination import Page, add_pagination
from fastapi_pagination.ext.sqlalchemy import paginate  
import httpx
import asyncio
from contextlib import asynccontextmanager

app_lifespan_data = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create and tear down the shared HTTP client for the API lifespan.

    Args:
        app: FastAPI application instance (unused; required by the lifespan
            protocol).

    Yields:
        Control back to FastAPI while :data:`app_lifespan_data` contains an
        open :class:`httpx.AsyncClient` with ``verify=False`` and a
        ``10.0`` second read timeout.
    """
    client = httpx.AsyncClient(verify=False, timeout=10.0)
    app_lifespan_data["http_client"] = client
    yield
    await client.aclose()


app = FastAPI(lifespan=lifespan)
add_pagination(app)


async def model_cisco_device_info(
    ip: str,
    port: int,
    username: str,
    password: str,
    https: bool,
    client: httpx.AsyncClient,
) -> tuple[str, str]:
    """Retrieve hostname and hardware model from a Cisco IOS XE device.

    Queries RESTCONF endpoints for native hostname and device inventory in
    parallel via :func:`~poller.cisco_polling.fetch_cisco_data_async`.

    Args:
        ip: Device management IP address.
        port: TCP port for RESTCONF (typically ``443`` or ``80``).
        username: HTTP Basic authentication username.
        password: HTTP Basic authentication password.
        https: When ``True``, use ``https://``; otherwise ``http://``.
        client: Shared async HTTP client from application lifespan.

    Returns:
        A ``(hostname, model)`` tuple. Missing fields fall back to
        ``"Unknown"``. ``model`` is taken from the first inventory entry's
        ``hw-description``, stripped of surrounding whitespace.

    Raises:
        ConnectionError: When either RESTCONF request fails or returns
            unparseable data.
    """

    protocol = "https" if https else "http"
    hostname_url = (
        f"{protocol}://{ip}:{port}/restconf/data/Cisco-IOS-XE-native:native/hostname"
    )
    model_url = f"{protocol}://{ip}:{port}/restconf/data/Cisco-IOS-XE-device-hardware-oper:device-hardware-data/device-hardware/device-inventory"
    hostname = "Unknown"
    model = "Unknown"

    try:
        tasks = [
            fetch_cisco_data_async(client, hostname_url, username, password),
            fetch_cisco_data_async(client, model_url, username, password),
        ]
        results = await asyncio.gather(*tasks)

        hostname_raw, model_raw = results
        hostname = hostname_raw.get("Cisco-IOS-XE-native:hostname", "Unknown")
        inventory_list = model_raw.get(
            "Cisco-IOS-XE-device-hardware-oper:device-inventory", []
        )

        if inventory_list:
            model = inventory_list[0].get("hw-description", "Unknown").strip()

    except Exception as e:
        logger.error(f"Error during modeling device: {ip}: {e}")
        raise ConnectionError(f"Error during modeling device: {ip}:{port}")

    return hostname, model


async def model_juniper_device_info(
    ip: str,
    port: int,
    username: str,
    password: str,
    https: bool,
    client: httpx.AsyncClient,
) -> tuple[str, str]:
    """Retrieve hostname and hardware model from a Juniper device.

    Calls the ``/rpc/get-system-information`` endpoint via
    :func:`~poller.juniper_polling.fetch_juniper_data_async`.

    Args:
        ip: Device management IP address.
        port: TCP port for Junos HTTP API (typically ``443`` or ``830``).
        username: HTTP Basic authentication username.
        password: HTTP Basic authentication password.
        https: When ``True``, use ``https://``; otherwise ``http://``.
        client: Shared async HTTP client from application lifespan.

    Returns:
        A ``(hostname, model)`` tuple parsed from ``system-information``.
        Missing fields fall back to ``"Unknown"``.

    Raises:
        ConnectionError: When the RPC request fails or returns unparseable
            data.
    """

    protocol = "https" if https else "http"
    system_url = f"{protocol}://{ip}:{port}/rpc/get-system-information"
    hostname = "Unknown"
    model = "Unknown"

    try:
        data = await fetch_juniper_data_async(client, system_url, username, password)
        sys_info = data.get("system-information", [{}])[0]
        hostname = sys_info.get("host-name", [{}])[0].get("data", "Unknown")
        model = sys_info.get("hardware-model", [{}])[0].get("data", "Unknown")

    except Exception as e:
        logger.error(f"Error during modeling device: {ip}: {e}")
        raise ConnectionError(f"Error during modeling device: {ip}:{port}")

    return hostname, model


async def discover_and_sync_interfaces(
    device: Device, client: httpx.AsyncClient, db
) -> list[Interface]:
    """Discover interfaces on a device and upsert them in PostgreSQL.

    Args:
        device: SQLAlchemy :class:`~poller.models.Device` row to query.
        client: Shared async HTTP client from application lifespan.
        db: Active SQLAlchemy session bound to PostgreSQL.

    Returns:
        List of :class:`~poller.models.Interface` rows after
        :func:`~poller.interface_discovery.sync_device_interfaces`
        reconciles the inventory with the database.
    """

    discovered = await discover_device_interfaces_async(device, client)
    return sync_device_interfaces(db, device.id, discovered)


@app.get("/health")
async def health():
    """Health-check endpoint for the poller API.

    Returns:
        dict: A JSON object with a single key:

        .. code-block:: json

            {"status": "OK"}

    Note:
        Does not verify database or InfluxDB connectivity.
    """

    return {"status": "OK"}


@app.post("/api/device", status_code=201)
async def add_device(device_in: DeviceCreate):
    """Register a new network device after live connectivity validation.

    Contacts the device to resolve hostname and model, persists a
    :class:`~poller.models.Device` row, then attempts interface discovery.
    Interface discovery failures are logged but do not roll back device
    creation.

    Args:
        device_in: Request body with ``ip``, ``port``, ``vendor``,
            ``username``, ``password``, and ``https`` fields.

    Returns:
        The created :class:`~poller.models.Device` ORM object (serialized
        without an explicit ``response_model``).

    Raises:
        fastapi.HTTPException: ``400`` for unsupported vendor; ``502`` when
            the device is unreachable; ``409`` on duplicate ``ip``/``port``;
            ``500`` on other database errors.
    """

    client = app_lifespan_data["http_client"]
    try:
        if device_in.vendor.lower() == "cisco":
            hostname, model = await model_cisco_device_info(
                device_in.ip,
                device_in.port,
                device_in.username,
                device_in.password,
                device_in.https,
                client,
            )
        elif device_in.vendor.lower() == "juniper":
            hostname, model = await model_juniper_device_info(
                device_in.ip,
                device_in.port,
                device_in.username,
                device_in.password,
                device_in.https,
                client,
            )
        else:
            # Return 400 if vendor is not supported
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported vendor: '{device_in.vendor}'"
            )
    except ConnectionError as e:
        # Return 502 if device not responds
        raise HTTPException(status_code=502, detail=str(e))

    try:
        with Session() as db:
            with db.begin():
                new_device = Device(
                    ip=device_in.ip,
                    port=device_in.port,
                    vendor=device_in.vendor,
                    username=device_in.username,
                    password=device_in.password,
                    hostname=hostname,
                    model=model,
                    https=device_in.https,
                    created_at=utc_now(),
                )
                db.add(new_device)

            db.refresh(new_device)
            logger.success(f"Successfully created device: {hostname} | {device_in.ip}")

            try:
                synced = await discover_and_sync_interfaces(new_device, client, db)
                db.commit()
                logger.success(
                    f"Discovered {len(synced)} interfaces for device: {hostname}"
                )
            except Exception as e:
                logger.warning(
                    f"Device {hostname} created but interface discovery failed: {e}"
                )

            db.refresh(new_device)
            return new_device

    except IntegrityError as e:
        # Device already exists in Database
        logger.warning(f"Device already exists: {device_in.ip}:{device_in.port} | {e}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Device: {device_in.ip}:{device_in.port} already exists in database.",
        )

    except Exception as e:
        # Catch other DB error
        logger.error(f"Database error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal database error occurred.",
        )


@app.delete("/api/device/{id}", status_code=200)
async def delete_device(id: int):
    """Remove a device and its interfaces from PostgreSQL by primary key.

    Args:
        id: Device primary key.

    Returns:
        dict: Confirmation payload:

        .. code-block:: json

            {"status": "deleted", "message": "Successfully deleted device"}

    Raises:
        fastapi.HTTPException: ``404`` when no device matches ``id``;
            ``500`` on database errors.
    """

    try:
        with Session() as db:
            device = db.query(Device).filter(Device.id == id).first()
            if not device:
                logger.warning(f"Attempted to delete non-existing device with ID: {id}")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Not found device with ID: {id}.",
                )

            db.delete(device)
            db.commit()

            logger.success(f"Successfully deleted device with ID: {id}")
            return {"status": "deleted", "message": "Successfully deleted device"}

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal database error occurred.",
        )


@app.post("/api/rediscover/{id}")
async def rediscover_device(id: int):
    """Refresh hostname, model, and interface inventory for an existing device.

    Re-runs vendor-specific modeling and interface discovery against the
    stored credentials, then updates the device row in place.

    Args:
        id: Device primary key.

    Returns:
        Updated :class:`~poller.models.Device` ORM object.

    Raises:
        fastapi.HTTPException: ``404`` when the device does not exist;
            ``400`` for unsupported vendor; ``502`` when the device is
            unreachable; ``500`` on database errors.
    """

    client = app_lifespan_data["http_client"]
    new_hostname, new_model = "Unknown", "Unknown"
    try:
        with Session() as db:
            device = db.query(Device).filter(Device.id == id).first()

            if not device:
                logger.warning(
                    f"Attempted to rediscover non-existing device with ID: {id}"
                )
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Not found device with ID: {id}.",
                )

            if device.vendor.lower() == "cisco":
                new_hostname, new_model = await model_cisco_device_info(
                    device.ip,
                    device.port,
                    device.username,
                    device.password,
                    device.https,
                    client,
                )
            elif device.vendor.lower() == "juniper":
                new_hostname, new_model = await model_juniper_device_info(
                    device.ip,
                    device.port,
                    device.username,
                    device.password,
                    device.https,
                    client,
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unsupported vendor: {device.vendor}",
                )

            device.hostname = new_hostname
            device.model = new_model

            synced = await discover_and_sync_interfaces(device, client, db)
            db.commit()
            db.refresh(device)
            logger.success(
                f"Successfully rediscovered device: {new_hostname} | {device.ip} "
                f"with {len(synced)} interfaces"
            )
            return device

    except HTTPException:
        raise
    except ConnectionError as e:
        logger.error(f"Rediscover failed: {e}")
        raise HTTPException(status_code=502, detail=f"Device unreachable: {e}")
    except Exception as e:
        logger.error(f"Rediscover failed: {e}")
        raise HTTPException(status_code=500, detail="Internal database error occurred.")


@app.get("/api/device/{id}", response_model=DeviceOut)
async def get_device(id: int):
    """Return a single device record by primary key.

    Args:
        id: Device primary key.

    Returns:
        :class:`~poller.models.DeviceOut`: Device details including
        credentials and ``created_at``.

    Raises:
        fastapi.HTTPException: ``404`` when no device matches ``id``.
    """

    with Session() as db:
        device = db.query(Device).filter(Device.id == id).first()
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Not found device with ID: {id} ",
            )
        return device


@app.get("/api/device/{id}/interfaces", response_model=list[InterfaceOut])
async def get_device_interfaces(id: int):
    """List interfaces discovered on a device, ordered by ``if_index``.

    Args:
        id: Device primary key.

    Returns:
        List of :class:`~poller.models.InterfaceOut` entries for the device.

    Raises:
        fastapi.HTTPException: ``404`` when no device matches ``id``.
    """

    with Session() as db:
        device = db.query(Device).filter(Device.id == id).first()
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Not found device with ID: {id}.",
            )

        interfaces = (
            db.query(Interface)
            .filter(Interface.device_id == id)
            .order_by(Interface.if_index.asc())
            .all()
        )
        return interfaces


@app.get("/api/devices", response_model=Page[DeviceOut])
async def get_devices():
    """Return a paginated list of all registered devices.

    Returns:
        :class:`fastapi_pagination.Page` of
        :class:`~poller.models.DeviceOut` items ordered by ascending ``id``.
        Page size follows ``fastapi-pagination`` defaults (typically ``50``).
    """

    with Session() as db:
        query = db.query(Device).order_by(Device.id.asc())
        return paginate(db, query)


@app.patch("/api/device/{id}", response_model=DeviceOut)
async def update_device(id: int, device_update: DeviceUpdate):
    """Partially update mutable device fields (credentials, port, HTTPS).

    Only fields present in the request body are changed; omitted fields
    remain unchanged.

    Args:
        id: Device primary key.
        device_update: Partial update with optional ``port``, ``username``,
            ``password``, and ``https``.

    Returns:
        Updated :class:`~poller.models.DeviceOut` representation.

    Raises:
        fastapi.HTTPException: ``404`` when no device matches ``id``.
    """

    with Session() as db:
        with db.begin():
            device = db.query(Device).filter(Device.id == id).first()

            if not device:
                raise HTTPException(status_code=404, detail="Device not found")

            update_data = device_update.model_dump(exclude_unset=True)

            for key, value in update_data.items():
                setattr(device, key, value)

        db.refresh(device)
        logger.info(f"Successfully updated device: {device.hostname} |  {device.ip}")
        return device


def main(): # pragma: no cover
    """Initialize PostgreSQL schema and start the Uvicorn API server.

    Calls :func:`~poller.config.init_db` before binding to ``0.0.0.0`` on
    :data:`~poller.config.API_PORT`. Returns early without starting the server
    when the database is unreachable.

    Returns:
        ``False`` when :func:`~poller.config.init_db` raises
        :class:`ConnectionError`; otherwise ``None`` (Uvicorn blocks until
        shutdown).
    """

    try:
        init_db()
    except ConnectionError as e:
        logger.critical(f"Finishing proggram")
        return False

    uvicorn.run(app, host="0.0.0.0", port=API_PORT)


if __name__ == "__main__": # pragma: no cover
    # Configure Logging
    logger.remove()
    logger.add(stderr, level="INFO")
    logger.add(
        "discovery.log",
        rotation="10 MB",
        retention="10 days",
        level="INFO",
        compression="tar",
    )

    main()
