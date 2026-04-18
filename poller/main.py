from config import engine, Base, Session
import cisco_polling
import juniper_polling
import models
from loguru import logger
from data_loader import seed_devices


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
    # DEBUG
    # print(f"{device_list=}")

    for device in device_list:
        device_data = {}
        if device.vendor == "cisco":
            # DEBUG
            device_data = cisco_polling.poll_cisco_device(device)

        elif device.vendor == "juniper":
            pass

        # DEBUG
        # print(f"--- DEBUG DATA FOR {device.hostname} ---")
        # print(device_data)

        cpu = device_data.get("cpu")
        mempct = device_data.get("memory_pct")
        interfaces = device_data.get("interfaces", [])

        # print(f"Szybki podgląd: CPU: {cpu}%, RAM: {mempct}%")
        # print(f"Liczba aktywnych interfejsów: {len(interfaces)}")

        # Debugowanie interfejsów w pętli
        # for iface in interfaces:
        #     print(
        #         f"  -> Port: {iface['name']} | In: {iface['in_octets']} | Out: {iface['out_octets']}"
        #     )


def save_polled_data(device, data):
    pass


def main():
    try:
        init_db()
    except ConnectionError as e:
        logger.critical(f"Finishing proggram")
        return False

    seed_devices()
    poll_devices()


if __name__ == "__main__":
    main()
