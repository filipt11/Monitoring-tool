from config import (
    Session,
    INFLUX_ORG,
    INFLUX_BUCKET,
    write_api,
    init_db,
    POLLING_INERVAL,
    MAX_DEVICES,
)
from cisco_polling import poll_cisco_device_async
from juniper_polling import poll_juniper_device_async
from models import Device, DeviceWithPolledData
from loguru import logger
from data_loader import seed_devices
from influxdb_client import Point
from time import time
import asyncio
import httpx
import signal

cached_device_list = []
last_polls = {}
semaphore = asyncio.Semaphore(MAX_DEVICES)


def get_current_devices() -> list[Device]:
    """Connect to postgreSQL and gather newest devices data required to polling"""

    with Session() as session:
        return session.query(Device).all()


async def poll_single_device(device: Device, client):
    async with semaphore:
        try:
            if device.vendor == "juniper":
                device_data = await poll_juniper_device_async(device, client)
            elif device.vendor == "cisco":
                device_data = await poll_cisco_device_async(device, client)
            else:
                return

            has_data = any([device_data.get("cpu"), device_data.get("memory_pct")])

            if not has_data:
                # Saving only down status
                await asyncio.to_thread(save_polled_device_data, device, status=0)
            else:
                # Validate object before saving
                polled_device = DeviceWithPolledData(
                    id=device.id,
                    hostname=device.hostname,
                    ip=device.ip,
                    cpu_usage=device_data.get("cpu"),
                    memory_total=device_data.get("total-memory"),
                    memory_usage=device_data.get("used-memory"),
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


async def poll_devices_main():
    global cached_device_list
    try:
        cached_device_list = get_current_devices()
    except Exception as e:
        logger.warning(
            "Can not establish connection with Postges DB, using cached device list for polling"
        )

    async with httpx.AsyncClient(verify=False) as client:
        tasks = [poll_single_device(d, client) for d in cached_device_list]
        await asyncio.gather(*tasks)


def save_polled_device_data(device: DeviceWithPolledData, status: int):
    point = (
        Point("device_statistics")
        .tag("hostname", device.hostname)
        .tag("ip", device.ip)
        .tag("id", device.id)
    )

    point.field("status", int(status))

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
):
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

        # Mapping admin/oper statuses to numbers
        admin_up = 1 if iface.get("admin_status") == "up" else 0
        oper_up = 1 if iface.get("oper_status") == "up" else 0

        if_name = iface.get("name")
        speed = int(iface.get("speed", 0))

        p.field("admin_status", admin_up)
        p.field("oper_status", oper_up)

        # If admin status is up, finding rest of metrics
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

            if in_bps is not None:
                p.field("in_bps", float(in_bps))
                p.field("in_util_pct", float(in_util))

            if out_bps is not None:
                p.field("out_bps", float(out_bps))
                p.field("out_util_pct", float(out_util))

        points.append(p)

    if points:
        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=points)
        logger.info(f"Saved {len(points)} interfaces for {device_hostname}")


def calculate_utilization(hostname, if_name, direction, current_octets, speed_bps):
    key = f"{hostname}_{if_name}_{direction}"
    current_time = time()

    if key in last_polls:
        prev_time, prev_octets = last_polls[key]
        time_delta = current_time - prev_time

        if time_delta <= 0:
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


def handle_exit(sig, frame):
    signame = signal.Signals(sig).name
    logger.warning(f"Received signal: {signame}")
    raise SystemExit


async def main():
    """"""
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


if __name__ == "__main__":
    # Handling exit signals
    signal.signal(signal.SIGTERM, handle_exit)
    signal.signal(signal.SIGINT, handle_exit)

    # Configure logger
    logger.add(
        "poller/poller.log",
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
