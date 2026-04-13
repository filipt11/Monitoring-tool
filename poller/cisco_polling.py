import requests
from requests.auth import HTTPBasicAuth


def poll_cisco_device(device):
    protocol = "https" if device.https else "http"
    base_url = f"{protocol}://{device.ip}:{device.port}"

    cpu_path = "/restconf/data/Cisco-IOS-XE-process-cpu-oper:cpu-usage/cpu-utilization/five-seconds"
    memory_path = "/restconf/data/Cisco-IOS-XE-memory-oper:memory-statistics"
    interface_path = "/restconf/data/ietf-interfaces:interfaces-state"

    full_cpu_url = f"{base_url}{cpu_path}"
    full_memory_url = f"{base_url}{memory_path}"
    full_interface_url = f"{base_url}{interface_path}"

    raw_cpu = fetch_data(full_cpu_url, device.username, device.password)
    raw_memory = fetch_data(full_memory_url, device.username, device.password)
    raw_interface = fetch_data(full_interface_url, device.username, device.password)

    cpu_val = parse_cpu(raw_cpu)
    total_memory, memory_val = parse_memory(raw_memory)
    if_index, in_octets, out_octets = parse_interfaces(raw_interface)
    memory_pct = memory_val / total_memory * 100

    # JSON should be returned here probably?
    return cpu_val, memory_val, memory_pct, if_index, in_octets, out_octets


def fetch_data(url, username, password):
    headers = {
        "Accept": "application/yang-data+json",
        "Content-Type": "application/yang-data+json",
    }

    try:
        response = requests.get(
            url,
            auth=HTTPBasicAuth(username, password),
            headers=headers,
            verify=False,
            timeout=10,
        )

        response.raise_for_status()

        return response.json()

    except Exception as e:
        return {}


def parse_cpu(raw_cpu):
    try:
        return int(raw_cpu["Cisco-IOS-XE-process-cpu-oper:five-seconds"])
    except Exception as e:
        # Polling logs to be added
        return None


def parse_memory(raw_memory):
    try:
        stats = raw_memory.get("Cisco-IOS-XE-memory-oper:memory-statistics", {})
        memory_list = stats.get("memory-statistic", [])

        for entry in memory_list:
            if entry.get("name") == "Processor":
                # JSON should be returned here probably?
                # return int(entry.get("used-memory", 0))
                used_memory = int(entry.get("used-memory", None))
                total_memory = int(entry.get("total-memory", None))
                return total_memory, used_memory

        return None
    except Exception as e:
        # Polling logs to be added
        return None


def parse_interfaces(raw_interfaces):
    # JSON should be returned here probably?
    stats = raw_interfaces.get("ietf-interfaces:interfaces-state", {})
    interface_list = stats.get("interface", [])
    response = {}

    for entry in interface_list:
        if entry.get("admin-status") == "up":
            speed = entry.get("speed")
            if_index = entry.get("if-index")
            admin_status = entry.get("admin-status")
            oper_status = entry.get("oper-status")
            mac = entry.get("phys-address")

            statistics = entry.get("statistics", {})
            in_octets = statistics.get("in-octets")
            out_octets = statistics.get("out-octets")

    return if_index, in_octets, out_octets
