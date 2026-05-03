from loguru import logger
from models import Device
import httpx
import asyncio


async def poll_cisco_device_async(device: Device, client: httpx.AsyncClient) -> dict:
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

    tasks = [
        fetch_cisco_data_async(client, full_cpu_url, device.username, device.password),
        fetch_cisco_data_async(
            client, full_memory_url, device.username, device.password
        ),
        fetch_cisco_data_async(
            client, full_interface_url, device.username, device.password
        ),
    ]

    # gather zwraca listę: [raw_cpu, raw_memory, raw_interfaces]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Rozpakowujemy wyniki (sprawdzając czy nie są wyjątkami)
    raw_cpu = results[0] if not isinstance(results[0], Exception) else None
    raw_memory = results[1] if not isinstance(results[1], Exception) else None
    raw_interface = results[2] if not isinstance(results[2], Exception) else None

    # Teraz musisz wywołać swoje funkcje PARSE (one są synchroniczne i to jest OK)
    cpu_val = parse_cpu(raw_cpu) if raw_cpu else None

    total_memory, memory_val, memory_pct = None, None, None
    if raw_memory:
        total_memory, memory_val = parse_memory(raw_memory)
        if total_memory > 0:
            memory_pct = round((memory_val / total_memory) * 100, 2)

    interfaces = parse_interfaces(raw_interface) if raw_interface else []

    result = {
        "status": "up" if any([cpu_val, memory_val, interfaces]) else "down",
        "cpu": cpu_val,
        "total-memory": total_memory,
        "used-memory": memory_val,
        "memory_pct": memory_pct,
        "interfaces": interfaces,
    }

    # Logowanie statusu
    if result["status"] == "up":
        logger.info(f"Successfully polled data for {device.hostname}")
    else:
        logger.error(
            f"Device {device.hostname} | {device.ip} is unreachable or returned no data"
        )

    return result


async def fetch_cisco_data_async(
    client: httpx.AsyncClient, url: str, username: str, password: str
) -> dict:
    headers = {
        "Accept": "application/yang-data+json",
        "Content-Type": "application/yang-data+json",
    }

    response = await client.get(
        url,
        auth=httpx.BasicAuth(username, password),
        headers=headers,
        timeout=10,
    )

    response.raise_for_status()
    return response.json()


def parse_cpu(raw_cpu: dict) -> int:
    return int(raw_cpu["Cisco-IOS-XE-process-cpu-oper:five-seconds"])


def parse_memory(raw_memory: dict) -> tuple[int, int]:
    """
    Returns:
        (total_memory, used_memory)
    """

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
