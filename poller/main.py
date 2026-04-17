import config
import cisco_polling
import juniper_polling
import models
from loguru import logger


def get_current_devices():
    """Connect to postgreSQL and gather newest devices data required to polling"""
    devices = []

    # Real connection to DB will be added

    devices.append(
        models.Device(
            id=1,
            ip="127.0.0.2",
            profile="high_utilized",
            hostname="r-high-1",
            vendor="cisco",
            model="Catalyst 9000",
            username="admin",
            password="123",
            port=443,
            https=False,
        )
    )

    devices.append(
        models.Device(
            id=2,
            ip="127.0.0.3",
            profile="low_utilized",
            hostname="r-low-1",
            vendor="cisco",
            model="Catalyst 9000",
            username="admin",
            password="123",
            port=443,
            https=False,
        )
    )

    devices.append(
        models.Device(
            id=3,
            ip="127.0.0.4",
            profile="standard",
            hostname="r-avg-1",
            vendor="cisco",
            model="Catalyst 9000",
            username="admin",
            password="123",
            port=443,
            https=False,
        )
    )

    return devices


def poll_devices():
    """Main polling function"""
    device_list = get_current_devices()
    # DEBUG
    print(f"{device_list=}")

    for device in device_list:
        device_data = {}
        if device.vendor == "cisco":
            # DEBUG
            device_data = cisco_polling.poll_cisco_device(device)

        elif device.vendor == "juniper":
            pass

        # DEBUG
        print(f"--- DEBUG DATA FOR {device.hostname} ---")
        print(device_data)

        cpu = device_data.get("cpu")
        mempct = device_data.get("memory_pct")
        interfaces = device_data.get("interfaces", [])

        print(f"Szybki podgląd: CPU: {cpu}%, RAM: {mempct}%")
        print(f"Liczba aktywnych interfejsów: {len(interfaces)}")

        # Debugowanie interfejsów w pętli
        for iface in interfaces:
            print(
                f"  -> Port: {iface['name']} | In: {iface['in_octets']} | Out: {iface['out_octets']}"
            )


def save_polled_data(device, data):
    pass


def main():
    poll_devices()


if __name__ == "__main__":
    main()
