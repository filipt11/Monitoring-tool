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


# Create simulated device based on specified profile
if PROFILE == "high_utilized":
    device = devices.HighUtilizedDevice(
        IP, VENDOR, HOSTNAME, MODEL, USERNAME, PASSWORD, PORT, HTTPS
    )
elif PROFILE == "low_utilized":
    device = devices.LowUtilizedDevice(
        IP, VENDOR, HOSTNAME, MODEL, USERNAME, PASSWORD, PORT, HTTPS
    )
else:
    device = devices.AverageUtilizedDevice(
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


# --- Router dla Juniper ---
juniper_router = APIRouter(prefix="/rpc/get-interface-information")

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
