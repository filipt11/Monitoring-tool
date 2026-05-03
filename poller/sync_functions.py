# File with sync function originally used to polling. Currently not being used, saved just in case.


def poll_devices():
    """Main polling function"""

    global cached_device_list
    try:
        cached_device_list = get_current_devices()
    except Exception as e:
        logger.warning(
            "Can not establish connection with Postges DB, using cached device list for polling"
        )

    for device in cached_device_list:
        device_data = {}
        if device.vendor == "cisco":
            device_data = poll_cisco_device(device)

        elif device.vendor == "juniper":
            device_data = poll_juniper_device(device)

        # DEBUG START

        cpu = device_data.get("cpu")
        mempct = device_data.get("memory_pct")
        interfaces = device_data.get("interfaces", [])
        print(f"--- DEBUG DATA FOR {device.hostname} ---")
        print(f"Szybki podgląd: CPU: {cpu}%, RAM: {mempct}%")
        print(f"Liczba aktywnych interfejsów: {len(interfaces)}")
        for iface in interfaces:
            print(
                f"  -> Port: {iface['name']} | In: {iface['in_octets']} | Out: {iface['out_octets']}"
            )
        print(f"{device_data=}")

        # DEBUG END

        try:
            has_data = any([device_data.get("cpu"), device_data.get("memory_pct")])

            if not has_data:
                logger.warning(
                    f"Skipping full data save for {device.hostname} - device unreachable"
                )
                save_polled_device_data(device, status=0)

            else:
                polled_device = DeviceWithPolledData(
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
                f"Error during saving data for device: {device.hostname} | {device.ip}: {e}"
            )

        try:
            interfaces_list = device_data.get("interfaces", [])

            if not interfaces_list:
                logger.warning(f"No interface data found for {device.hostname}")
            else:
                save_polled_interface_data(
                    device.id, device.hostname, device.ip, interfaces_list
                )

        except Exception as e:
            logger.error(
                f"Error during saving interface data for {device.hostname} | {device.ip}: {e}"
            )


def main():
    try:
        init_db()
    except ConnectionError as e:
        logger.critical(f"Finishing proggram")
        return False

    seed_devices()

    while True:
        poll_devices()
        sleep(POLLING_INERVAL)


if __name__ == "__main__":
    logger.add(
        "poller/poller.log",
        rotation="10 MB",
        retention="10 days",
        compression="tar",
        level="INFO",
    )
    main()


def poll_cisco_device(device: Device) -> dict:
    """Main polling function that polls Cisco Device and parse it's data"""

    # Initialize default values
    cpu_val = None
    memory_val = None
    total_memory = None
    memory_pct = None
    interfaces = []

    # Build URLs using to poll device
    protocol = "https" if device.https else "http"
    base_url = f"{protocol}://{device.ip}:{device.port}"

    cpu_path = "/restconf/data/Cisco-IOS-XE-process-cpu-oper:cpu-usage/cpu-utilization/five-seconds"
    memory_path = "/restconf/data/Cisco-IOS-XE-memory-oper:memory-statistics"
    interface_path = "/restconf/data/ietf-interfaces:interfaces-state"

    full_cpu_url = f"{base_url}{cpu_path}"
    full_memory_url = f"{base_url}{memory_path}"
    full_interface_url = f"{base_url}{interface_path}"

    # Poll device and parse returned values
    try:
        raw_cpu = fetch_data(full_cpu_url, device.username, device.password)
        if raw_cpu:
            cpu_val = parse_cpu(raw_cpu)
    except Exception as e:
        logger.error(
            f"Error during polling CPU value for device: {device.hostname} | {device.ip}: {e}"
        )

    try:
        raw_memory = fetch_data(full_memory_url, device.username, device.password)
        if raw_memory:
            total_memory, memory_val = parse_memory(raw_memory)
            if total_memory and total_memory > 0:
                memory_pct = round((memory_val / total_memory) * 100, 2)
    except Exception as e:
        logger.error(
            f"Error during polling Memory values for device: {device.hostname} | {device.ip}: {e}"
        )

    try:
        raw_interface = fetch_data(full_interface_url, device.username, device.password)
        if raw_interface:
            interfaces = parse_interfaces(raw_interface)
    except Exception as e:
        logger.error(
            f"Error during polling Interface values for device: {device.hostname} | {device.ip}: {e}"
        )

    # Build returned JSON
    result = {
        "status": "up" if any([cpu_val, memory_val, interfaces]) else "down",
        "cpu": cpu_val,
        "total-memory": total_memory,
        "used-memory": memory_val,
        "memory_pct": memory_pct,
        "interfaces": interfaces,
    }

    if result["status"] == "up":
        logger.info(f"Successfully polled data for {device.hostname}")
    else:
        logger.error(f"Device {device.hostname} is unreachable or returned no data")

    return result


def fetch_data(url: str, username: str, password: str) -> dict:
    headers = {
        "Accept": "application/yang-data+json",
        "Content-Type": "application/yang-data+json",
    }

    response = requests.get(
        url,
        auth=HTTPBasicAuth(username, password),
        headers=headers,
        verify=False,
        timeout=10,
    )

    response.raise_for_status()

    return response.json()


def poll_juniper_device(device: Device) -> dict:
    """Main polling function that polls Juniper Device and parse it's data"""

    # Initialize default values
    cpu_val = None
    memory_val = None
    total_memory = None
    memory_pct = None
    interfaces = []

    # Build URLs using to poll device
    protocol = "https" if device.https else "http"
    base_url = f"{protocol}://{device.ip}:{device.port}"

    route_engine_path = "/rpc/get-route-engine-information"
    interface_path = "/rpc/get-interface-information"

    full_route_engine_url = f"{base_url}{route_engine_path}"
    full_interface_url = f"{base_url}{interface_path}"

    # Poll device and parse returned values
    try:
        raw_route_engine = fetch_data(
            full_route_engine_url, device.username, device.password
        )
        if raw_route_engine:
            cpu_val = parse_cpu(raw_route_engine)
            total_memory, memory_val, memory_pct = parse_memory(raw_route_engine)
    except Exception as e:
        logger.error(
            f"Error during polling CPU/Memory value for device: {device.hostname} | {device.ip}: {e}"
        )

    try:
        raw_interfaces = fetch_data(
            full_interface_url, device.username, device.password
        )
        if raw_interfaces:
            interfaces = parse_interfaces(raw_interfaces)
    except Exception as e:
        logger.error(
            f"Error during polling Interface values for device: {device.hostname} | {device.ip}: {e}"
        )

    # Build returned JSON
    result = {
        "status": "up" if any([cpu_val, memory_val, interfaces]) else "down",
        "cpu": cpu_val,
        "total-memory": total_memory,
        "used-memory": memory_val,
        "memory_pct": memory_pct,
        "interfaces": interfaces,
    }

    if result["status"] == "up":
        logger.info(f"Successfully polled data for {device.hostname}")
    else:
        logger.error(f"Device {device.hostname} is unreachable or returned no data")

    return result


def fetch_data_juniper(url: str, username: str, password: str) -> dict:
    headers = {"Accept": "application/json"}

    response = requests.post(
        url,
        auth=HTTPBasicAuth(username, password),
        headers=headers,
        data="",
        verify=False,
        timeout=10,
    )

    response.raise_for_status()

    return response.json()
