from config import (
    Session,
    init_db,
    MICROSERVICE_PORT,
)
from loguru import logger
from models import Device, DeviceCreate, DeviceOut, DeviceUpdate
from fastapi import FastAPI, HTTPException, status
import uvicorn
from cisco_polling import fetch_cisco_data_async
from juniper_polling import fetch_juniper_data_async
from sys import stderr
from sqlalchemy.exc import IntegrityError
from fastapi_pagination import Page, add_pagination, paginate
from fastapi_pagination.ext.sqlalchemy import paginate
import httpx
import asyncio
from contextlib import asynccontextmanager

app_lifespan_data = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
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
    """Try connect to device and perform basic modeling"""

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
        raise ConnectionError(f"Error during modeling device: {ip}")

    return hostname, model


async def model_juniper_device_info(
    ip: str,
    port: int,
    username: str,
    password: str,
    https: bool,
    client: httpx.AsyncClient,
) -> tuple[str, str]:
    """Try connect to device and perform basic modeling"""

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
        raise ConnectionError(f"Error during modeling device: {ip}")

    return hostname, model


@app.get("/health")
async def health():
    """Return status 'OK' if API started correctly."""

    return {"status:": "OK"}


@app.post("/api/device", status_code=201)
async def add_device(device_in: DeviceCreate):
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
    except ConnectionError as e:
        # Return 400 if device not responds
        raise HTTPException(status_code=400, detail=str(e))

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
                )
                db.add(new_device)

            db.refresh(new_device)
            logger.success(f"Successfully created device: {hostname} | {device_in.ip}")
            return {"status": "created", "device": new_device}

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

            db.commit()
            db.refresh(device)
            logger.success(
                f"Successfully rediscovered device: {new_hostname} | {device.ip}"
            )
            return {"status": "updated", "device": device}

    except HTTPException:
        raise
    except ConnectionError as e:
        logger.error(f"Rediscover failed: {e}")
        raise HTTPException(status_code=400, detail=f"Device unreachable: {e}")
    except Exception as e:
        logger.error(f"Rediscover failed: {e}")
        raise HTTPException(status_code=500, detail="Internal database error occurred.")


@app.get("/api/device/{id}", response_model=DeviceOut)
async def get_device(id: int):
    with Session() as db:
        device = db.query(Device).filter(Device.id == id).first()
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Not found device with ID: {id} ",
            )
        return device


@app.get("/api/devices", response_model=Page[DeviceOut])
async def get_devices():
    with Session() as db:
        query = db.query(Device).order_by(Device.id.asc())
        return paginate(db, query)


@app.patch("/api/device/{id}", response_model=DeviceOut)
async def update_device(id: int, device_update: DeviceUpdate):
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


def main():
    """Connect to DB and start uvicorn server"""

    try:
        init_db()
    except ConnectionError as e:
        logger.critical(f"Finishing proggram")
        return False

    uvicorn.run(app, host="0.0.0.0", port=MICROSERVICE_PORT)


if __name__ == "__main__":
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
