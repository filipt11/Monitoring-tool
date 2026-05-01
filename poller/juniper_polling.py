import requests
from requests.auth import HTTPBasicAuth
from loguru import logger
from models import Device
from re import search


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


def fetch_data(url: str, username: str, password: str) -> dict:
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


def parse_cpu(raw_route_engine: dict) -> int:
    re_info = raw_route_engine["route-engine-information"][0]
    route_engine = re_info["route-engine"][0]

    idle_str = route_engine["cpu-idle"][0]["data"]
    idle_val = int(idle_str)

    return 100 - idle_val


def parse_memory(raw_route_engine: dict) -> tuple[int, int, float]:
    re_data = raw_route_engine["route-engine-information"][0]["route-engine"][0]
    total_raw = re_data["memory-installed-size"][0]["data"]
    util_pct_raw = re_data["memory-buffer-utilization"][0]["data"]

    total_memory = int(search(r"\d+", total_raw).group()) * 1024**2
    used_memory_pct = float(util_pct_raw)
    used_memory = int((used_memory_pct / 100) * total_memory)

    return total_memory, used_memory, used_memory_pct


def parse_interfaces(raw_interfaces: dict) -> list[dict]:
    phys_interfaces = raw_interfaces["interface-information"][0]["physical-interface"]
    parsed_results = []

    for phys in phys_interfaces:

        def get_junos_val(obj, key, default="0"):
            try:
                val = obj[key][0]["data"]
                return val if val is not None else default
            except (KeyError, IndexError, TypeError):
                return default

        admin_status = get_junos_val(phys, "admin-status", "down")

        if admin_status == "up":
            name = get_junos_val(phys, "name", "unknown")

            speed_raw = get_junos_val(phys, "speed", "0")
            speed_match = search(r"\d+", speed_raw)
            speed = int(speed_match.group()) * 10**6 if speed_match else 0

            logical_if = phys.get("logical-interface", [{}])[0]
            stats = logical_if.get("traffic-statistics", [{}])[0]

            if_data = {
                "name": name,
                "if_index": int(get_junos_val(phys, "local-index", "0")),
                "in_octets": int(get_junos_val(stats, "input-bytes", "0")),
                "out_octets": int(get_junos_val(stats, "output-bytes", "0")),
                "speed": speed,
                "admin_status": admin_status,
                "oper_status": get_junos_val(phys, "oper-status", "down"),
                "mac": get_junos_val(phys, "current-physical-address", "unknown"),
            }
            parsed_results.append(if_data)

    if not parsed_results:
        raise ValueError("No active interfaces with statistics found")

    return parsed_results
