from fastapi import APIRouter, FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
import devices
import os
import secrets
import uvicorn

app = FastAPI()
security = HTTPBasic()

# Set up global environments based on system environments
PROFILE = os.getenv("DEVICE_PROFILE", "standard").lower()
IP = os.getenv("DEVICE_IP", "0.0.0.0")
HOSTNAME = os.getenv("DEVICE_HOSTNAME", "s-cat-def-1")
VENDOR = os.getenv("DEVICE_VENDOR", "cisco").lower()
MODEL = os.getenv("DEVICE_MODEL", "Catalyst 9000")
USERNAME = os.getenv("DEVICE_USERNAME", "admin")
PASSWORD = os.getenv("DEVICE_PASSWORD", "123")
PORT = os.getenv("DEVICE_PORT", 443)
raw_https = os.getenv("DEVICE_IS_HTTPS", "false")
HTTPS = raw_https.lower() in ("true", "1", "yes")


# Create simulated device based on vendor and specified profile
if VENDOR == "cisco":
    if PROFILE == "high_utilized":
        device = devices.HighUtilizedCiscoDevice(
            IP, VENDOR, HOSTNAME, MODEL, USERNAME, PASSWORD, PORT, HTTPS
        )
    elif PROFILE == "low_utilized":
        device = devices.LowUtilizedCiscoDevice(
            IP, VENDOR, HOSTNAME, MODEL, USERNAME, PASSWORD, PORT, HTTPS
        )
    else:
        device = devices.AverageUtilizedCiscoDevice(
            IP, VENDOR, HOSTNAME, MODEL, USERNAME, PASSWORD, PORT, HTTPS
        )
elif VENDOR == "juniper":
    if PROFILE == "high_utilized":
        device = devices.HighUtilizedJuniperDevice(
            IP, VENDOR, HOSTNAME, MODEL, USERNAME, PASSWORD, PORT, HTTPS
        )
    elif PROFILE == "low_utilized":
        device = devices.LowUtilizedJuniperDevice(
            IP, VENDOR, HOSTNAME, MODEL, USERNAME, PASSWORD, PORT, HTTPS
        )
    else:
        device = devices.AverageUtilizedJuniperDevice(
            IP, VENDOR, HOSTNAME, MODEL, USERNAME, PASSWORD, PORT, HTTPS
        )


def authenticate(credentials: HTTPBasicCredentials = Depends(security)):
    """Function that secures endpoints
    Credentials are being set up during container/server initialization."""

    is_user_ok = secrets.compare_digest(credentials.username, USERNAME)
    is_pass_ok = secrets.compare_digest(credentials.password, PASSWORD)

    if not (is_user_ok and is_pass_ok):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username


# Define URL paths for Cisco Devices
cisco_router = APIRouter(prefix="/restconf/data")


@cisco_router.get("/health")
async def health():
    """Return status 'OK' if API started correctly."""

    return {"status:": "OK"}


@cisco_router.get(
    "/Cisco-IOS-XE-process-cpu-oper{colon}cpu-usage/cpu-utilization/five-seconds"
)
async def cpu_usage():
    """Return data regarding device CPU usage."""

    return {"Cisco-IOS-XE-process-cpu-oper:five-seconds": device.get_cpu()}


@cisco_router.get("/Cisco-IOS-XE-memory-oper{colon}memory-statistics")
async def memory_usage():
    """Return data regarding device Memory statistics."""

    total_memory = device.get_total_memory()
    used_memory = device.get_used_memory()
    free_memory = total_memory - used_memory

    return {
        "Cisco-IOS-XE-memory-oper:memory-statistics": {
            "memory-statistic": [
                {
                    "name": "Processor",
                    "total-memory": str(total_memory),
                    "used-memory": str(used_memory),
                    "free-memory": str(free_memory),
                    "lowest-usage": "470392804",
                    "highest-usage": "479335280",
                },
                {
                    "name": "reserve Processor",
                    "total-memory": "102404",
                    "used-memory": "92",
                    "free-memory": "102312",
                    "lowest-usage": "102312",
                    "highest-usage": "102312",
                },
                {
                    "name": "lsmpi_io",
                    "total-memory": "3149400",
                    "used-memory": "3148576",
                    "free-memory": "824",
                    "lowest-usage": "824",
                    "highest-usage": "412",
                },
            ]
        }
    }


@cisco_router.get(
    "/Cisco-IOS-XE-device-hardware-oper{colon}device-hardware-data/device-hardware/device-inventory"
)
async def get_model():
    """Return data in JSON format containing data regarding device inventory."""

    return {
        "Cisco-IOS-XE-device-hardware-oper:device-inventory": [
            {
                "hw-type": "hw-type-emmc",
                "hw-dev-index": 0,
                "version": "V01",
                "part-number": "C9KV-UADP-8P",
                "serial-number": "98DVJUONW1X",
                "hw-description": device.model,
                "dev-name": "Switch 1",
                "field-replaceable": False,
                "hw-class": "hw-class-physical",
            },
            {
                "hw-type": "hw-type-chassis",
                "hw-dev-index": 1,
                "version": "V01",
                "part-number": "C9KV-UADP-8P",
                "serial-number": "98DVJUONW1X",
                "hw-description": device.model,
                "dev-name": "Switch 1",
                "field-replaceable": True,
                "hw-class": "hw-class-physical",
            },
            {
                "hw-type": "hw-type-dram",
                "hw-dev-index": 2,
                "version": "",
                "part-number": "",
                "serial-number": "",
                "hw-description": "Physical Memory",
                "dev-name": "Memory",
                "field-replaceable": False,
                "hw-class": "hw-class-physical",
            },
            {
                "hw-type": "hw-type-cpu",
                "hw-dev-index": 3,
                "version": " 6",
                "part-number": " GenuineIntel",
                "serial-number": "",
                "hw-description": " Intel(R) Xeon(R) Gold 6248R CPU @ 3.00",
                "dev-name": "CPU",
                "field-replaceable": False,
                "hw-class": "hw-class-physical",
            },
        ]
    }


@cisco_router.get("/Cisco-IOS-XE-native{colon}native/hostname")
async def get_hostname():
    """Return device current hostname."""

    return {"Cisco-IOS-XE-native:hostname": device.hostname}


@cisco_router.get("/ietf-interfaces{colon}interfaces-state")
async def get_interfaces_state():
    """Return data regarding device interfaces statistics."""

    raw_interfaces = device.get_interfaces()

    interface_output = []

    for item in raw_interfaces:
        interface_output.append(
            {
                "name": item["name"],
                "type": item["type"],
                "admin-status": item["admin-status"],
                "oper-status": item["oper-status"],
                "last-change": "2026-03-07T15:37:09.39+00:00",
                "if-index": item["if-index"],
                "phys-address": item["phys-address"],
                "speed": item["speed"],
                "statistics": {
                    "discontinuity-time": "2026-03-06T19:34:19.276+00:00",
                    "in-octets": item["in-octets"],
                    "out-octets": item["out-octets"],
                    "in-unicast-pkts": "0",
                    "in-broadcast-pkts": "0",
                    "in-multicast-pkts": "0",
                    "in-discards": 0,
                    "in-errors": 0,
                    "in-unknown-protos": 0,
                    "out-unicast-pkts": "0",
                    "out-broadcast-pkts": "0",
                    "out-multicast-pkts": "0",
                    "out-discards": 0,
                    "out-errors": 0,
                },
            }
        )

    return {"ietf-interfaces:interfaces-state": {"interface": interface_output}}


# Define URL paths for Juniper devices
juniper_router = APIRouter(prefix="/rpc")


@juniper_router.post("/get-interface-information")
async def get_interface_information():
    raw_interfaces = device.get_interfaces()

    physical_interfaces_output = []

    for item in raw_interfaces:
        speed = int(item["speed"])
        speed_mbps = int(speed // 10**6)
        speed_formatted = f"{speed_mbps}mbps"

        ifd = {
            "name": [{"data": item["name"]}],
            "admin-status": [
                {
                    "data": item["admin-status"],
                    "attributes": {"junos:format": "Enabled"},
                }
            ],
            "oper-status": [{"data": item["oper-status"]}],
            "local-index": [{"data": str(item["if-index"])}],
            "snmp-index": [{"data": str(int(item["if-index"]) + 220)}],
            "if-type": [{"data": item["type"]}],
            "mtu": [{"data": "1514"}],
            "sonet-mode": [{"data": "LAN-PHY"}],
            "mru": [{"data": "1522"}],
            "source-filtering": [{"data": "disabled"}],
            "speed": [{"data": speed_formatted}],
            "eth-switch-error": [{"data": "none"}],
            "remote-bounce": [{"data": "none"}],
            "bpdu-error": [{"data": "none"}],
            "ld-pdu-error": [{"data": "none"}],
            "l2pt-error": [{"data": "none"}],
            "loopback": [{"data": "disabled"}],
            "if-flow-control": [{"data": "enabled"}],
            "if-auto-negotiation": [{"data": "enabled"}],
            "if-remote-fault": [{"data": "online"}],
            "pad-to-minimum-frame-size": [{"data": "Disabled"}],
            "if-device-flags": [
                {"ifdf-present": [{"data": [None]}], "ifdf-running": [{"data": [None]}]}
            ],
            "if-config-flags": [
                {
                    "iff-hardware-down": [{"data": [None]}],
                    "iff-snmp-traps": [{"data": [None]}],
                    "internal-flags": [{"data": [None]}],
                }
            ],
            "if-media-flags": [{"ifmf-none": [{"data": [None]}]}],
            "physical-interface-cos-information": [
                {
                    "physical-interface-cos-hw-max-queues": [{"data": "8"}],
                    "physical-interface-cos-use-max-queues": [{"data": "8"}],
                }
            ],
            "current-physical-address": [
                {"data": item.get("phys-address", "00:50:56:be:c8:e0")}
            ],
            "hardware-physical-address": [
                {"data": item.get("phys-address", "00:50:56:be:c8:e0")}
            ],
            "traffic-statistics": [
                {
                    "input-bps": [{"data": "0"}],
                    "input-pps": [{"data": "0"}],
                    "output-bps": [{"data": "0"}],
                    "output-pps": [{"data": "0"}],
                }
            ],
            "active-alarms": [
                {"interface-alarms": [{"ethernet-alarm-link-down": [{"data": [None]}]}]}
            ],
            "active-defects": [
                {"interface-alarms": [{"ethernet-alarm-link-down": [{"data": [None]}]}]}
            ],
            "ethernet-pcs-statistics": [
                {
                    "attributes": {"junos:style": "verbose"},
                    "bit-error-seconds": [{"data": "0"}],
                    "errored-blocks-seconds": [{"data": "0"}],
                }
            ],
            "interface-transmit-statistics": [{"data": "Enabled"}],
            "logical-interface": [
                {
                    "name": [{"data": f"{item['name']}.0"}],
                    "local-index": [{"data": str(int(item["if-index"]) + 100)}],
                    "snmp-index": [{"data": str(int(item["if-index"]) + 200)}],
                    "traffic-statistics": [
                        {
                            "input-bytes": [{"data": item["in-octets"]}],
                            "output-bytes": [{"data": item["out-octets"]}],
                            "input-packets": [{"data": "0"}],
                            "output-packets": [{"data": "0"}],
                        }
                    ],
                }
            ],
        }

        physical_interfaces_output.append(ifd)

    return {
        "interface-information": [{"physical-interface": physical_interfaces_output}]
    }


@juniper_router.post("/get-route-engine-information")
async def get_route_engine_information():

    cpu_idle = int(100 - device.get_cpu())
    total_memory = device.get_total_memory()
    used_memory = device.get_used_memory()
    memory_MB = total_memory // (1024**2)
    formatted_memory = f"({memory_MB} MB installed)"
    memory_utilization = (used_memory / total_memory) * 100
    dram = f"{memory_MB - 7} MB"

    return {
        "route-engine-information": [
            {
                "route-engine": [
                    {
                        "slot": [{"data": "0"}],
                        "mastership-state": [{"data": "master"}],
                        "mastership-priority": [{"data": "master (default)"}],
                        "status": [{"data": "OK"}],
                        "memory-dram-size": [{"data": dram}],
                        "memory-installed-size": [{"data": formatted_memory}],
                        "memory-buffer-utilization": [
                            {"data": str(memory_utilization)}
                        ],
                        "cpu-user": [{"data": "0"}],
                        "cpu-background": [{"data": "0"}],
                        "cpu-system": [{"data": "1"}],
                        "cpu-interrupt": [{"data": "0"}],
                        "cpu-idle": [{"data": str(cpu_idle)}],
                        "cpu-user1": [{"data": "1"}],
                        "cpu-background1": [{"data": "0"}],
                        "cpu-system1": [{"data": "2"}],
                        "cpu-interrupt1": [{"data": "0"}],
                        "cpu-idle1": [{"data": "97"}],
                        "cpu-user2": [{"data": "1"}],
                        "cpu-background2": [{"data": "0"}],
                        "cpu-system2": [{"data": "2"}],
                        "cpu-interrupt2": [{"data": "0"}],
                        "cpu-idle2": [{"data": "97"}],
                        "cpu-user3": [{"data": "2"}],
                        "cpu-background3": [{"data": "0"}],
                        "cpu-system3": [{"data": "2"}],
                        "cpu-interrupt3": [{"data": "0"}],
                        "cpu-idle3": [{"data": "97"}],
                        "model": [{"data": "RE-VMX"}],
                        "start-time": [
                            {
                                "data": "2026-04-29 14:08:40 UTC",
                                "attributes": {"junos:seconds": "1777471720"},
                            }
                        ],
                        "up-time": [
                            {
                                "data": "29 minutes, 21 seconds",
                                "attributes": {"junos:seconds": "1761"},
                            }
                        ],
                        "last-reboot-reason": [
                            {"data": "Router rebooted after a normal shutdown."}
                        ],
                        "load-average-one": [{"data": "2.50"}],
                        "load-average-five": [{"data": "1.42"}],
                        "load-average-fifteen": [{"data": "0.93"}],
                    }
                ]
            }
        ]
    }


@juniper_router.post("/get-system-information")
async def get_system_information():
    return {
        "system-information": [
            {
                "host-name": [{"data": device.hostname}],
                "hardware-model": [{"data": device.model}],
                "os-name": [{"data": "junos"}],
                "os-version": [{"data": "25.2R2.11"}],
                "serial-number": [{"data": "VM69F21129F0"}],
            }
        ]
    }


# Choose API Router based on device Vendor
if VENDOR == "cisco":
    app.include_router(cisco_router, dependencies=[Depends(authenticate)])

elif VENDOR == "juniper":
    app.include_router(juniper_router, dependencies=[Depends(authenticate)])


def main():
    """Start uvicorn server"""

    uvicorn.run(app, host="0.0.0.0", port=PORT)


if __name__ == "__main__":
    main()
