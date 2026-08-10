"""FastAPI application simulating Cisco IOS XE or Juniper network devices.

The simulator exposes vendor-specific HTTP endpoints that return realistic
RESTCONF (Cisco) or RPC-style (Juniper) JSON payloads. Device behaviour
(CPU, memory, interface counters) is driven by a :class:`~simulator.devices.BaseDevice`
subclass selected at startup from environment variables.

Environment Variables:
    DEVICE_PROFILE (str): Utilization preset. Accepted values are
        ``high_utilized``, ``low_utilized``, ``average_utilized``, or
        ``custom``. Any other value (including the default ``standard``)
        falls back to :class:`~simulator.devices.AverageUtilizedCiscoDevice`.
    DEVICE_IP (str): Simulated device IP address. Default: ``0.0.0.0``.
    DEVICE_HOSTNAME (str): Simulated hostname. Default: ``s-cat-def-1``.
    DEVICE_VENDOR (str): Device vendor, ``cisco`` or ``juniper``. Default:
        ``cisco``.
    DEVICE_MODEL (str): Hardware model string returned in inventory/system
        responses. Default: ``Catalyst 9000``.
    DEVICE_USERNAME (str): HTTP Basic auth username. Default: ``admin``.
    DEVICE_PASSWORD (str): HTTP Basic auth password. Default: ``123``.
    DEVICE_PORT (int): Uvicorn listen port. Default: ``443``.
    DEVICE_IS_HTTPS (str): Whether the simulated device uses HTTPS
        (informational only). Truthy values: ``true``, ``1``, ``yes``.
        Default: ``false``.

    When ``DEVICE_PROFILE=custom``, the following optional variables override
    fields on :class:`~simulator.logic.CustomProfile`:

    DEVICE_MEAN, DEVICE_DEVIATION, DEVICE_MIN_VAL, DEVICE_MAX_VAL,
    DEVICE_SPIKE_CHANCE, DEVICE_SPIKE_MIN, DEVICE_SPIKE_MAX,
    DEVICE_SPIKE_MEAN, DEVICE_SPIKE_DEVIATION, DEVICE_DROP_CHANCE,
    DEVICE_DROP_MIN, DEVICE_DROP_MAX, DEVICE_DROP_MEAN,
    DEVICE_DROP_DEVIATION.

Attributes:
    app (fastapi.FastAPI): Root FastAPI application instance.
    security (fastapi.security.HTTPBasic): HTTP Basic authentication scheme.
    PROFILE (str): Lowercased value of ``DEVICE_PROFILE``.
    IP (str): Simulated device IP address.
    HOSTNAME (str): Simulated device hostname.
    VENDOR (str): Lowercased device vendor (``cisco`` or ``juniper``).
    MODEL (str): Device model string.
    USERNAME (str): Expected HTTP Basic username.
    PASSWORD (str): Expected HTTP Basic password.
    PORT (int): Server listen port.
    HTTPS (bool): Whether HTTPS is enabled for the simulated device.
    device (simulator.devices.BaseDevice): Active simulated device instance.
    cisco_router (fastapi.APIRouter): RESTCONF routes for Cisco devices
        (prefix ``/restconf/data``).
    juniper_router (fastapi.APIRouter): RPC routes for Juniper devices
        (prefix ``/rpc``).
"""

from fastapi import APIRouter, FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from simulator import devices
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
PORT = int(os.getenv("DEVICE_PORT", 443))
raw_https = os.getenv("DEVICE_IS_HTTPS", "false")
HTTPS = raw_https.lower() in ("true", "1", "yes")


# Create simulated device based on vendor and specified profile
device: devices.BaseDevice

# Custom profile scenario
if PROFILE == "custom":
    env_mapping = {
        "mean": ("DEVICE_MEAN", float),
        "deviation": ("DEVICE_DEVIATION", float),
        "min_val": ("DEVICE_MIN_VAL", int),
        "max_val": ("DEVICE_MAX_VAL", int),

        "spike_chance_pct": ("DEVICE_SPIKE_CHANCE", float),
        "spike_min": ("DEVICE_SPIKE_MIN", int),
        "spike_max": ("DEVICE_SPIKE_MAX", int),
        "spike_mean": ("DEVICE_SPIKE_MEAN", float),
        "spike_deviation": ("DEVICE_SPIKE_DEVIATION", float),

        "drop_chance_pct": ("DEVICE_DROP_CHANCE", float),
        "drop_min": ("DEVICE_DROP_MIN", int),
        "drop_max": ("DEVICE_DROP_MAX", int),
        "drop_mean": ("DEVICE_DROP_MEAN", float),
        "drop_deviation": ("DEVICE_DROP_DEVIATION", float),
    }

    profile_kwargs = {}
    for field_name, (env_name, field_type) in env_mapping.items():
        env_value = os.getenv(env_name)
        if env_value is not None:
            profile_kwargs[field_name] = field_type(env_value)

    custom_profile = devices.CustomProfile(**profile_kwargs)

    custom_vendor_mapping = {
        "cisco": devices.customUtilizedCiscoDevice,
        "juniper": devices.customUtilizedJuniperDevice,
    }
    
    device_class = custom_vendor_mapping.get(VENDOR, devices.customUtilizedCiscoDevice)
    device = device_class(IP, VENDOR, HOSTNAME, MODEL, USERNAME, PASSWORD, PORT, HTTPS, profile=custom_profile)

# Defined profile scenario
else:
    device_mapping = {
        ("cisco", "high_utilized"): devices.HighUtilizedCiscoDevice,
        ("cisco", "low_utilized"): devices.LowUtilizedCiscoDevice,
        ("cisco", "average_utilized"): devices.AverageUtilizedCiscoDevice,
        ("juniper", "high_utilized"): devices.HighUtilizedJuniperDevice,
        ("juniper", "low_utilized"): devices.LowUtilizedJuniperDevice,
        ("juniper", "average_utilized"): devices.AverageUtilizedJuniperDevice,
    }

    device_class = device_mapping.get((VENDOR, PROFILE), devices.AverageUtilizedCiscoDevice)
    device = device_class(IP, VENDOR, HOSTNAME, MODEL, USERNAME, PASSWORD, PORT, HTTPS)


def authenticate(credentials: HTTPBasicCredentials = Depends(security)) -> str:
    """Validate HTTP Basic credentials for all simulator endpoints.

    Args:
        credentials: Username and password extracted from the
            ``Authorization: Basic`` header by FastAPI's dependency injection.

    Returns:
        The authenticated username when credentials match ``USERNAME`` and
        ``PASSWORD``.

    Raises:
        fastapi.HTTPException: With status code ``401 Unauthorized`` when the
            username or password does not match. The response includes a
            ``WWW-Authenticate: Basic`` header.
    """

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
    """Health-check endpoint for the Cisco RESTCONF simulator.

    Returns:
        dict: A JSON object with a single key:

        .. code-block:: json

            {"status": "OK"}

    Note:
        This route requires HTTP Basic authentication (applied at router level).
    """

    return {"status": "OK"}


@cisco_router.get(
    "/Cisco-IOS-XE-process-cpu-oper{colon}cpu-usage/cpu-utilization/five-seconds"
)
async def cpu_usage():
    """Return simulated five-second CPU utilization (Cisco RESTCONF).

    Returns:
        dict: RESTCONF payload keyed by
            ``Cisco-IOS-XE-process-cpu-oper:five-seconds``. The value is an
            integer percentage in the range ``0``–``100``, produced by
            :meth:`~simulator.devices.BaseDevice.get_cpu`.

    Note:
        Requires HTTP Basic authentication.
    """

    return {"Cisco-IOS-XE-process-cpu-oper:five-seconds": device.get_cpu()}


@cisco_router.get("/Cisco-IOS-XE-memory-oper{colon}memory-statistics")
async def memory_usage():
    """Return simulated processor memory statistics (Cisco RESTCONF).

    Returns:
        dict: RESTCONF payload under
            ``Cisco-IOS-XE-memory-oper:memory-statistics`` containing a
            ``memory-statistic`` list. The ``Processor`` entry reflects live
            values from :meth:`~simulator.devices.BaseDevice.get_total_memory`
            and :meth:`~simulator.devices.BaseDevice.get_used_memory`; other
            entries are static placeholders.

    Note:
        Requires HTTP Basic authentication.
    """

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
    """Return simulated device hardware inventory (Cisco RESTCONF).

    Returns:
        dict: RESTCONF payload under
            ``Cisco-IOS-XE-device-hardware-oper:device-inventory``. The list
            contains chassis, DRAM, and CPU entries. ``hw-description`` fields
            for chassis entries use :attr:`~simulator.devices.BaseDevice.model`.

    Note:
        Requires HTTP Basic authentication.
    """

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
    """Return the simulated device hostname (Cisco RESTCONF).

    Returns:
        dict: RESTCONF payload mapping
            ``Cisco-IOS-XE-native:hostname`` to
            :attr:`~simulator.devices.BaseDevice.hostname`.

    Note:
        Requires HTTP Basic authentication.
    """

    return {"Cisco-IOS-XE-native:hostname": device.hostname}


@cisco_router.get("/ietf-interfaces{colon}interfaces-state")
async def get_interfaces_state():
    """Return simulated interface state and traffic counters (Cisco RESTCONF).

    Returns:
        dict: RESTCONF payload under ``ietf-interfaces:interfaces-state``
            with an ``interface`` list. Each interface includes admin/oper
            status, speed, MAC address, and ``statistics`` with
            ``in-octets`` / ``out-octets`` counters from
            :meth:`~simulator.devices.BaseDevice.get_interfaces`.

    Note:
        Requires HTTP Basic authentication. Timestamp fields
        (``last-change``, ``discontinuity-time``) are static placeholders.
    """

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
    """Return simulated Juniper interface information (RPC).

    Returns:
        dict: Juniper RPC-style payload with key ``interface-information``
            containing a ``physical-interface`` list. Each entry mirrors
            Juniper's ``get-interface-information`` output, including logical
            sub-interfaces with byte counters sourced from
            :meth:`~simulator.devices.BaseDevice.get_interfaces`.

    Note:
        Requires HTTP Basic authentication. Most fields outside counters and
        status are static placeholders.
    """

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
    """Return simulated Juniper route-engine CPU and memory statistics (RPC).

    Returns:
        dict: Juniper RPC-style payload under ``route-engine-information``.
            ``cpu-idle`` is derived as ``100 - get_cpu()``; memory fields use
            :meth:`~simulator.devices.BaseDevice.get_total_memory` and
            :meth:`~simulator.devices.BaseDevice.get_used_memory`.

    Note:
        Requires HTTP Basic authentication. Load averages and secondary CPU
        fields are static placeholders.
    """

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
    """Return simulated Juniper system information (RPC).

    Returns:
        dict: Juniper RPC-style payload under ``system-information`` with
            ``host-name`` from :attr:`~simulator.devices.BaseDevice.hostname`
            and ``hardware-model`` from
            :attr:`~simulator.devices.BaseDevice.model`. OS version and serial
            number are static placeholders.

    Note:
        Requires HTTP Basic authentication.
    """

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


def main() -> None: # pragma: no cover
    """Start the simulator FastAPI server with Uvicorn.

    Binds to ``0.0.0.0`` on :data:`PORT`. Vendor-specific routes are already
    registered on :data:`app` at import time based on :data:`VENDOR`.

    Raises:
        OSError: If the configured port is already in use or cannot be bound.
    """

    uvicorn.run(app, host="0.0.0.0", port=PORT)


if __name__ == "__main__": # pragma: no cover
    main()
