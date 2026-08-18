"""Background polling loop for Cisco and Juniper network devices.

Reads the device inventory from PostgreSQL (populated via
:mod:`poller.api`), polls each device asynchronously, and writes CPU,
memory, availability, and interface metrics to InfluxDB. Concurrency is
limited by :data:`semaphore` to :data:`~poller.config.MAX_DEVICES` devices
in parallel.

Configuration:
    Polling interval is :data:`~poller.config.POLLING_INERVAL` seconds
    (default ``300``). InfluxDB bucket and organisation come from
    :mod:`poller.config`.

Attributes:
    cached_device_list (list[poller.models.Device]): Last successfully loaded
        device list from PostgreSQL. Reused when the database is temporarily
        unreachable.
    last_polls (dict[str, tuple[float, int]]): Previous interface counter
        samples keyed by ``"{hostname}_{if_name}_{direction}"`` for
        utilization calculation in :func:`calculate_utilization`.
    semaphore (asyncio.Semaphore): Limits concurrent device polls to
        :data:`~poller.config.MAX_DEVICES`.
"""

from poller.config import (
    Session,
    INFLUX_ORG,
    INFLUX_BUCKET,
    write_api,
    init_db,
    POLLING_INERVAL,
    MAX_DEVICES,
)
from poller.cisco_polling import poll_cisco_device_async
from poller.juniper_polling import poll_juniper_device_async
from poller.models import Device, DeviceWithPolledData
from loguru import logger
from poller.data_loader import seed_devices
from influxdb_client import Point
import time
import asyncio
import httpx
import signal
from typing import cast, Any

# Initialize list used for caching devices
cached_device_list: list[Device] = []
# Initialize dict used for cache last polled interfaces data
last_polls: dict[str, tuple[float, int]] = {}
# Initialize sempahore with max device size
semaphore = asyncio.Semaphore(MAX_DEVICES)


def get_current_devices() -> list[Device]:
    """Load all registered devices from PostgreSQL.

    Returns:
        List of :class:`~poller.models.Device` ORM rows currently stored
        in the ``devices`` table.
    """

    with Session() as session:
        return session.query(Device).all()


async def poll_single_device(device: Device, client: httpx.AsyncClient) -> None:
    """Poll one device and persist metrics to InfluxDB.

    Dispatches to :func:`~poller.juniper_polling.poll_juniper_device_async`
    or :func:`~poller.cisco_polling.poll_cisco_device_async` based on
    ``device.vendor``. When CPU and memory are unavailable, only a
    ``status=0`` (down) point is written.

    Args:
        device: Device row with connection credentials and metadata.
        client: Shared :class:`httpx.AsyncClient` for HTTP requests.

    Note:
        Acquires :data:`semaphore` for the duration of the poll. Errors are
        logged and swallowed so other devices continue polling.
    """

    async with semaphore:
        try:
            # Run correct function based on device vendor
            if device.vendor == "juniper":
                device_data = await poll_juniper_device_async(device, client)
            elif device.vendor == "cisco":
                device_data = await poll_cisco_device_async(device, client)
            else:
                return

            has_data = any([device_data.get("cpu"), device_data.get("memory_pct")])

            if not has_data:
                # Saving only down status
                await asyncio.to_thread(
                    save_polled_device_data,
                    cast(DeviceWithPolledData, device),
                    status=0,
                )
            else:
                # Validate object before saving
                polled_device = DeviceWithPolledData(
                    id=device.id,
                    hostname=device.hostname,
                    ip=device.ip,
                    cpu_usage=device_data.get("cpu"),
                    memory_total=device_data.get("total_memory"),
                    memory_usage=device_data.get("used_memory"),
                    memory_usage_pct=device_data.get("memory_pct"),
                )
                # Save device data
                await asyncio.to_thread(
                    save_polled_device_data, polled_device, status=1
                )

                # Save interfaces data
                interfaces = device_data.get("interfaces", [])
                if interfaces:
                    await asyncio.to_thread(
                        save_polled_interface_data,
                        device.id,
                        device.hostname,
                        device.ip,
                        interfaces,
                    )

        except Exception as e:
            logger.error(f"Failed {device.hostname}: {e}")


async def poll_devices_main() -> None:
    """Poll every known device once and write results to InfluxDB.

    Refreshes :data:`cached_device_list` from PostgreSQL when possible;
    on connection failure, reuses the previously cached list and logs a
    warning. All devices are polled concurrently via
    :func:`asyncio.gather`.

    Note:
        Creates a dedicated :class:`httpx.AsyncClient` per cycle with
        ``verify=False``.
    """

    # Try to gather current device list from DB, if error occurs uses chached list
    global cached_device_list
    try:
        cached_device_list = get_current_devices()
    except Exception as e:
        logger.warning(
            "Can not establish connection with Postges DB, using cached device list for polling"
        )

    # Poll devices and save data
    async with httpx.AsyncClient(verify=False) as client:
        tasks = [poll_single_device(d, client) for d in cached_device_list]
        await asyncio.gather(*tasks)


def save_polled_device_data(device: DeviceWithPolledData, status: int) -> None:
    """Write a single device metrics point to InfluxDB.

    Args:
        device: Polled CPU and memory values together with identity tags.
        status: ``1`` when the device responded with metrics; ``0`` when
            only availability (down) should be recorded.

    Note:
        Writes to measurement ``device_statistics`` in
        :data:`~poller.config.INFLUX_BUCKET`. Metric fields are omitted
        when ``status`` is ``0``.
    """

    point = (
        Point("device_statistics")
        .tag("hostname", device.hostname)
        .tag("ip", device.ip)
        .tag("id", device.id)
    )

    # Save status for each device
    point.field("status", int(status))

    # If device is up, save rest of the data
    if status == 1:
        if device.cpu_usage is not None:
            point.field("cpu_usage", int(device.cpu_usage))

        if device.memory_total is not None:
            point.field("memory_total", int(device.memory_total))

        if device.memory_usage is not None:
            point.field("memory_usage", int(device.memory_usage))

        if device.memory_usage_pct is not None:
            point.field("memory_usage_pct", float(device.memory_usage_pct))

    write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)

    if status == 1:
        logger.info(
            f"Successfully saved polled data for {device.hostname} | {device.ip}"
        )
    else:
        logger.warning(
            f"Successfully saved DOWN status for {device.hostname} | {device.ip}"
        )


def save_polled_interface_data(
    device_id: int, device_hostname: str, device_ip: str, interfaces_raw: list
) -> None:
    """Write interface counter and utilization points to InfluxDB.

    Args:
        device_id: Primary key of the polled device.
        device_hostname: Hostname tag for InfluxDB series.
        device_ip: Management IP tag for InfluxDB series.
        interfaces_raw: List of interface dicts from vendor polling
            (see :class:`~poller.models.InterfaceData`).

    Note:
        Writes to measurement ``interface_statistics``. Utilization fields
        (``in_bps``, ``out_bps``, ``in_util_pct``, ``out_util_pct``) are
        computed via :func:`calculate_utilization` when a previous sample
        exists in :data:`last_polls`. Admin-down interfaces store status
        fields only.
    """

    points = []

    for iface in interfaces_raw:
        # Create basic point with tags
        p = (
            Point("interface_statistics")
            .tag("hostname", device_hostname)
            .tag("device_id", device_id)
            .tag("ip", device_ip)
            .tag("if_name", iface.get("name"))
            .tag("if_index", iface.get("if_index"))
        )

        # Map admin/oper statuses to numbers
        admin_up = 1 if iface.get("admin_status") == "up" else 0
        oper_up = 1 if iface.get("oper_status") == "up" else 0

        if_name = iface.get("name")
        speed = int(iface.get("speed", 0))

        p.field("admin_status", admin_up)
        p.field("oper_status", oper_up)

        # If admin status is up, find rest of metrics
        if admin_up == 1:
            in_octets = int(iface.get("in_octets", 0))
            out_octets = int(iface.get("out_octets", 0))

            p.field("in_octets", in_octets)
            p.field("out_octets", out_octets)
            if speed > 0:
                p.field("speed_bps", speed)

            in_bps, in_util = calculate_utilization(
                device_hostname, if_name, "in", in_octets, speed
            )
            out_bps, out_util = calculate_utilization(
                device_hostname, if_name, "out", out_octets, speed
            )

            if in_bps is not None and in_util is not None:
                p.field("in_bps", float(in_bps))
                p.field("in_util_pct", float(in_util))

            if out_bps is not None and out_util is not None:
                p.field("out_bps", float(out_bps))
                p.field("out_util_pct", float(out_util))

        points.append(p)

    if points:
        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=points)
        logger.info(f"Saved {len(points)} interfaces for {device_hostname}")


def calculate_utilization(
    hostname: str, if_name: str, direction: str, current_octets: int, speed_bps: int
) -> tuple[float | None, float | None]:
    """Compute link bitrate and utilization from SNMP-style octet counters.

    Compares ``current_octets`` against the previous sample stored in
    :data:`last_polls` for the same ``hostname``, ``if_name``, and
    ``direction`` (``"in"`` or ``"out"``).

    Args:
        hostname: Device hostname used as part of the cache key.
        if_name: Interface name used as part of the cache key.
        direction: Traffic direction, ``"in"`` or ``"out"``.
        current_octets: Latest cumulative octet counter from the device.
        speed_bps: Interface speed in bits per second for utilization %.

    Returns:
        ``(bps, util_pct)`` when a valid delta exists; ``(None, None)`` on
        the first sample, non-positive time delta, or counter reset.
    """

    key = f"{hostname}_{if_name}_{direction}"
    current_time = time.monotonic()

    if key in last_polls:
        prev_time, prev_octets = last_polls[key]
        time_delta = current_time - prev_time

        if time_delta <= 0:
            last_polls[key] = (current_time, current_octets)
            return None, None

        # Handle counters reset
        if current_octets < prev_octets:
            logger.warning(f"Counter reset detected for {key} Skipping this sample")
            last_polls[key] = (current_time, current_octets)
            return None, None

        octets_delta = current_octets - prev_octets

        bps = (octets_delta * 8) / time_delta
        util_pct = (bps / speed_bps * 100) if speed_bps > 0 else 0

        last_polls[key] = (current_time, current_octets)
        return bps, util_pct

    last_polls[key] = (current_time, current_octets)
    return None, None


def handle_exit(sig: Any, frame: Any) -> None: # pragma: no cover
    """Translate SIGTERM/SIGINT into a clean process shutdown.

    Args:
        sig: Signal number received by the handler.
        frame: Current stack frame (unused).

    Raises:
        SystemExit: Always raised after logging the signal name.
    """

    signame = signal.Signals(sig).name
    logger.warning(f"Received signal: {signame}")
    raise SystemExit


async def main() -> None: # pragma: no cover
    """Initialize the database and run the polling loop indefinitely.

    Calls :func:`~poller.config.init_db`, seeds example devices via
    :func:`~poller.data_loader.seed_devices`, then repeatedly invokes
    :func:`poll_devices_main` separated by
    :data:`~poller.config.POLLING_INERVAL` seconds.

    Note:
        Returns early (without polling) when PostgreSQL initialization
        fails.
    """

    try:
        # Init Postgres DB
        init_db()
    except Exception as e:
        logger.critical(f"Finishing proggram {e}")
        return

    # Add example devices to DB
    seed_devices()

    # Start polling devices
    while True:
        await poll_devices_main()
        await asyncio.sleep(POLLING_INERVAL)


if __name__ == "__main__": # pragma: no cover
    # Handling exit signals
    signal.signal(signal.SIGTERM, handle_exit)
    signal.signal(signal.SIGINT, handle_exit)

    # Configure logger
    logger.add(
        "poller.log",
        rotation="10 MB",
        retention="10 days",
        compression="tar",
        level="INFO",
    )
    try:
        asyncio.run(main())
    except SystemExit:
        logger.warning("Closing proggram...")
    finally:
        pass
