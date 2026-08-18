"""Cisco IOS XE RESTCONF polling and response parsing.

Contacts three RESTCONF endpoints in parallel (CPU, memory, interfaces),
parses YANG JSON payloads, and returns a normalized
:class:`~poller.models.PollingResult` consumed by :mod:`poller.main` and
:mod:`poller.api` (device modeling).

RESTCONF paths polled:

- ``/restconf/data/Cisco-IOS-XE-process-cpu-oper:cpu-usage/cpu-utilization/five-seconds``
- ``/restconf/data/Cisco-IOS-XE-memory-oper:memory-statistics``
- ``/restconf/data/ietf-interfaces:interfaces-state``
"""

from loguru import logger
from .models import Device, PollingResult, InterfaceData
import httpx
import asyncio
from typing import Any


async def poll_cisco_device_async(
    device: Device, client: httpx.AsyncClient
) -> PollingResult:
    """Poll a Cisco device and return normalized metrics.

    Fetches CPU, memory, and interface RESTCONF data concurrently. Each
    request is isolated — a failure in one endpoint does not block parsing
    of the others. Device status is ``"up"`` when at least one metric
    category returns data.

    Args:
        device: :class:`~poller.models.Device` row with connection
            credentials and ``https`` flag.
        client: Shared :class:`httpx.AsyncClient` from the polling loop.

    Returns:
        :class:`~poller.models.PollingResult` with ``cpu``, memory fields,
        and a list of admin-up :class:`~poller.models.InterfaceData`
        entries.
    """

    # Initialize default values for parsed metrics
    cpu_val = None
    memory_val = None
    total_memory = None
    memory_pct = None
    interfaces = []

    # Build URLs used to poll device RESTCONF endpoints
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

    results = await asyncio.gather(*tasks, return_exceptions=True)

    raw_cpu = results[0] if not isinstance(results[0], BaseException) else None
    raw_memory = results[1] if not isinstance(results[1], BaseException) else None
    raw_interfaces = results[2] if not isinstance(results[2], BaseException) else None

    # Parse each result only when request succeeded
    if raw_cpu:
        try:
            cpu_val = parse_cpu(raw_cpu)
        except Exception as e:
            logger.error(f"Error parsing CPU for {device.hostname} | {device.ip}: {e}")

    if raw_memory:
        try:
            total_memory, memory_val = parse_memory(raw_memory)
            if total_memory > 0:
                memory_pct = round((memory_val / total_memory) * 100, 2)

        except Exception as e:
            logger.error(
                f"Error parsing Memory for {device.hostname} | {device.ip}: {e}"
            )

    if raw_interfaces:
        try:
            interfaces = parse_interfaces(raw_interfaces)
        except Exception as e:
            logger.error(
                f"Error parsing Interfaces for {device.hostname} | {device.ip}: {e}"
            )

    result: PollingResult = {
        "status": "up" if any([cpu_val, memory_val, interfaces]) else "down",
        "cpu": cpu_val,
        "total_memory": total_memory,
        "used_memory": memory_val,
        "memory_pct": memory_pct,
        "interfaces": interfaces,
    }

    if result["status"] == "up":
        logger.info(f"Successfully polled data for {device.hostname}")
    else:
        logger.error(
            f"Device {device.hostname} | {device.ip} is unreachable or returned no data"
        )

    return result


async def fetch_cisco_data_async(
    client: httpx.AsyncClient, url: str, username: str, password: str
) -> dict[Any, Any]:
    """Perform an authenticated GET against a Cisco RESTCONF endpoint.

    Args:
        client: Async HTTP client used for the request.
        url: Full RESTCONF URL (including scheme, host, port, and path).
        username: HTTP Basic authentication username.
        password: HTTP Basic authentication password.

    Returns:
        Parsed JSON response body as a dictionary.

    Raises:
        httpx.HTTPStatusError: When the device returns a non-2xx status.
    """

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


def parse_cpu(raw_cpu: dict[str, Any]) -> int:
    """Extract five-second CPU utilization from a RESTCONF CPU response.

    Args:
        raw_cpu: JSON payload from the Cisco CPU RESTCONF endpoint.

    Returns:
        CPU usage as an integer percentage (``0``–``100``).

    Raises:
        KeyError: When the expected YANG key is missing.
        ValueError: When the value cannot be converted to ``int``.
    """

    return int(raw_cpu["Cisco-IOS-XE-process-cpu-oper:five-seconds"])


def parse_memory(raw_memory: dict[str, Any]) -> tuple[int, int]:
    """Extract processor memory totals from a RESTCONF memory response.

    Args:
        raw_memory: JSON payload from the Cisco memory RESTCONF endpoint.

    Returns:
        ``(total_memory, used_memory)`` in bytes for the ``Processor`` pool.

    Raises:
        ValueError: When no ``Processor`` entry exists in the statistics
            list.
    """

    stats = raw_memory["Cisco-IOS-XE-memory-oper:memory-statistics"]
    memory_list = stats["memory-statistic"]

    for entry in memory_list:
        if entry["name"] == "Processor":
            used_memory = int(entry["used-memory"])
            total_memory = int(entry["total-memory"])
            return total_memory, used_memory

    raise ValueError("Could not find 'Processor' entry in raw_memory")


def parse_interfaces(raw_interfaces: dict[str, Any]) -> list[InterfaceData]:
    """Parse admin-up interfaces with traffic counters for metric polling.

    Args:
        raw_interfaces: JSON payload from the
            ``ietf-interfaces:interfaces-state`` RESTCONF endpoint.

    Returns:
        List of :class:`~poller.models.InterfaceData` for interfaces with
        ``admin-status`` equal to ``"up"``.

    Raises:
        ValueError: When no qualifying interfaces are found.
    """

    stats = raw_interfaces["ietf-interfaces:interfaces-state"]
    interface_list = stats["interface"]

    parsed_results: list[InterfaceData] = []

    for entry in interface_list:
        if entry.get("admin-status") == "up":
            statistics = entry["statistics"]

            # Only include interfaces that are administratively up
            if_data: InterfaceData = {
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


def parse_interfaces_catalog(raw_interfaces: dict[str, Any]) -> list[InterfaceData]:
    """Parse all interface entries for inventory discovery.

    Unlike :func:`parse_interfaces`, includes administratively down
    interfaces and does not require non-empty statistics. Used by
    :mod:`poller.interface_discovery` when syncing the PostgreSQL
    interface catalog.

    Args:
        raw_interfaces: JSON payload from the
            ``ietf-interfaces:interfaces-state`` RESTCONF endpoint.

    Returns:
        List of :class:`~poller.models.InterfaceData` for every interface
        in the response (may be empty).
    """

    stats = raw_interfaces["ietf-interfaces:interfaces-state"]
    interface_list = stats["interface"]

    parsed_results: list[InterfaceData] = []

    for entry in interface_list:
        statistics = entry.get("statistics", {})
        if_data: InterfaceData = {
            "name": entry["name"],
            "if_index": int(entry["if-index"]),
            "in_octets": int(statistics.get("in-octets", 0)),
            "out_octets": int(statistics.get("out-octets", 0)),
            "speed": int(entry.get("speed", 0)),
            "admin_status": entry.get("admin-status", "down"),
            "oper_status": entry.get("oper-status", "down"),
            "mac": entry.get("phys-address", "unknown"),
        }
        parsed_results.append(if_data)

    return parsed_results
