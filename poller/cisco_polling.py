import requests
from requests.auth import HTTPBasicAuth
from loguru import logger
import sys
from models import Device

logger.add(
    sys.stdout,
    format="{time} {level} {message}",
    level="INFO",
)


def poll_cisco_device(device: Device) -> dict:
    """Main polling function that polls Device and parse it's data"""

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


def parse_cpu(raw_cpu: dict) -> int:
    return int(raw_cpu["Cisco-IOS-XE-process-cpu-oper:five-seconds"])


def parse_memory(raw_memory: dict) -> tuple[int, int]:
    """_summary_"""

    stats = raw_memory["Cisco-IOS-XE-memory-oper:memory-statistics"]
    memory_list = stats["memory-statistic"]

    for entry in memory_list:
        if entry["name"] == "Processor":
            used_memory = int(entry["used-memory"])
            total_memory = int(entry["total-memory"])
            return total_memory, used_memory

    raise ValueError("Could not find 'Processor' entry in raw_memory")


def parse_interfaces(raw_interfaces: dict) -> list[dict]:
    stats = raw_interfaces["ietf-interfaces:interfaces-state"]
    interface_list = stats["interface"]

    parsed_results = []

    for entry in interface_list:
        if entry.get("admin-status") == "up":
            statistics = entry["statistics"]

            if_data = {
                "name": entry["name"],
                "if_index": int(entry["if-index"]),
                "in_octets": int(statistics["in-octets"]),
                "out_octets": int(statistics["out-octets"]),
                "speed": int(entry["speed"]),
                "admin_status": entry["admin-status"],
                "oper_status": entry["oper-status"],
                "mac": entry.get("phys-address", "unknown"),
            }
            parsed_results.append(if_data)

    if not parsed_results:
        raise ValueError("No active interfaces with statistics found")

    return parsed_results
