import config
import cisco_polling
import juniper_polling
import models


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

    # Inventory logs to be added there

    return devices


def poll_devices():
    """Main polling function"""
    device_list = get_current_devices()
    # DEBUG
    print(f"{device_list=}")
    for device in device_list:
        if device.vendor == "cisco":
            # DEBUG
            cpu, mem, mempct, if_index, in_octets, out_octets = (
                cisco_polling.poll_cisco_device(device)
            )
        elif device.vendor == "juniper":
            # DEBUG
            cpu, mem, mempct, if_index, in_octets, out_octets = (
                juniper_polling.poll_juniper_device(device)
            )

        # DEBUG
        print(f"{cpu=} {mem=} {mempct=} {if_index=} {in_octets=} {out_octets=}")


def save_polled_data(device, data):
    pass


if __name__ == "__main__":
    poll_devices()
