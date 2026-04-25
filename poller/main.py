from config import (
    engine,
    Base,
    Session,
    influx_client,
    INFLUX_ORG,
    INFLUX_BUCKET,
    write_api,
)
import cisco_polling
import juniper_polling
import models
from loguru import logger
from data_loader import seed_devices
from influxdb_client import Point
from influxdb_client.client.write_api import SYNCHRONOUS
from time import sleep


def init_db():
    try:
        Base.metadata.create_all(engine)
        logger.success("Successfully initialized Postgres DB")
    except Exception as e:
        logger.error(f"Database error: {e}")
        raise ConnectionError


def get_current_devices() -> list[models.Device]:
    """Connect to postgreSQL and gather newest devices data required to polling"""

    with Session() as session:
        return session.query(models.Device).all()


def poll_devices():
    """Main polling function"""

    device_list = get_current_devices()

    for device in device_list:
        device_data = {}
        if device.vendor == "cisco":
            device_data = cisco_polling.poll_cisco_device(device)

        elif device.vendor == "juniper":
            pass

        cpu = device_data.get("cpu")
        mempct = device_data.get("memory_pct")
        interfaces = device_data.get("interfaces", [])

        # DEBUG START
        # print(f"--- DEBUG DATA FOR {device.hostname} ---")
        # print(device_data)
        # print(f"Szybki podgląd: CPU: {cpu}%, RAM: {mempct}%")
        # print(f"Liczba aktywnych interfejsów: {len(interfaces)}")
        # for iface in interfaces:
        #     print(
        #         f"  -> Port: {iface['name']} | In: {iface['in_octets']} | Out: {iface['out_octets']}"
        #     )
        # print(f"{device_data=}")
        # DEBUG END

        try:
            has_data = any([device_data.get("cpu"), device_data.get("memory_pct")])

            if not has_data:
                logger.warning(
                    f"Skipping full data save for {device.hostname} - device unreachable"
                )
                save_polled_device_data(device, status=0)

            else:
                polled_device = models.DeviceWithPolledData(
                    id=device.id,
                    hostname=device.hostname,
                    ip=device.ip,
                    cpu_usage=device_data.get("cpu"),
                    memory_total=device_data.get("total-memory"),
                    memory_usage=device_data.get("used-memory"),
                    memory_usage_pct=device_data.get("memory_pct"),
                )

                save_polled_device_data(polled_device, status=1)

        except Exception as e:
            logger.error(
                f"Error during saving data for device: {device.hostname} | {device.ip}"
            )


def save_polled_device_data(device: models.DeviceWithPolledData, status: int):
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
    device_id: int, device_hostname: str, device_ip: str, interfaces
):
    pass


def main():
    try:
        init_db()
    except ConnectionError as e:
        logger.critical(f"Finishing proggram")
        return False

    seed_devices()

    while True:
        poll_devices()
        sleep(60 * 5)


if __name__ == "__main__":
    logger.add(
        "poller/poller.log",
        rotation="10 MB",
        retention="10 days",
        compression="tar",
        level="INFO",
    )
    main()
