# Simulator API Documentation

## Overview

The Simulator API provides RESTCONF (Cisco) and RPC (Juniper) endpoints that mimic real network devices. Configuration is done via environment variables.

**Base URL**: `http://localhost:8001`  
**Authentication**: HTTP Basic Auth (admin:123 by default)

For full interactive API documentation, visit the **Swagger UI** at: `http://localhost:8001/docs` for cisco API, or `http://localhost:8004/docs` for Juniper API 

---

## Configuration

The simulator creates virtual devices based on environment variables. Default values are used if variables are not set.

**Example configuration for first Cisco device:**
```bash
export DEVICE_VENDOR=cisco                     # cisco or juniper
export DEVICE_PROFILE=high_utilized            # high_utilized, average_utilized, low_utilized, custom
export DEVICE_HOSTNAME=r-cisco-1
export DEVICE_MODEL="Catalyst 9000"
export DEVICE_USERNAME=admin
export DEVICE_PASSWORD=123
export DEVICE_PORT=8001
export DEVICE_IS_HTTPS=false                   # false for http, true for https
```

**Custom utilization profile example**
```bash
export DEVICE_VENDOR=cisco
export DEVICE_PROFILE=custom
export DEVICE_HOSTNAME=r-cisco-custom
export DEVICE_MODEL="Catalyst 9000"
export DEVICE_USERNAME=admin
export DEVICE_PASSWORD=123
export DEVICE_PORT=8003
export DEVICE_IS_HTTPS=false

export DEVICE_MEAN=45
export DEVICE_DEVIATION=8
export DEVICE_MIN_VAL=20
export DEVICE_MAX_VAL=75

export DEVICE_SPIKE_CHANCE=4
export DEVICE_SPIKE_MIN=85
export DEVICE_SPIKE_MAX=100
export DEVICE_SPIKE_MEAN=92
export DEVICE_SPIKE_DEVIATION=4

export DEVICE_DROP_CHANCE=2
export DEVICE_DROP_MIN=1
export DEVICE_DROP_MAX=15
export DEVICE_DROP_MEAN=8
export DEVICE_DROP_DEVIATION=3
```

**Multiple devices example** (start simulator multiple times or use Docker Compose):
```bash
# First device
export DEVICE_PORT=8001 && python main.py

# Second device (in another terminal)
export DEVICE_PORT=8002 && python main.py
```

---

## Quick Endpoint Reference

### Cisco IOS XE Endpoints
**All endpoints require HTTP Basic Auth**
- **GET** `/restconf/data/Cisco-IOS-XE-process-cpu-oper:cpu-usage/cpu-utilization/five-seconds` - CPU %
- **GET** `/restconf/data/Cisco-IOS-XE-memory-oper:memory-statistics` - Memory stats
- **GET** `/restconf/data/Cisco-IOS-XE-device-hardware-oper:device-hardware-data/device-hardware/device-inventory` - Hardware info
- **GET** `/restconf/data/Cisco-IOS-XE-native:native/hostname` - Hostname
- **GET** `/restconf/data/ietf-interfaces:interfaces-state` - Interface statistics & traffic

### Juniper RPC Endpoints
**All endpoints require HTTP Basic Auth and POST method**
- **POST** `/rpc/get-system-information` - System info (like hostname, model, version)
- **POST** `/rpc/get-interface-information` - Interface statistics & traffic
- **POST** `/rpc/get-route-engine-information` - CPU and memory stats

---

## Usage Examples

```bash
# Check Cisco simulator health (with authentication)
curl -u admin:123 http://localhost:8001/restconf/data/health

# Cisco device - get hostname
curl -u admin:123 http://localhost:8001/restconf/data/Cisco-IOS-XE-native:native/hostname

# Cisco device - get CPU
curl -u admin:123 http://localhost:8001/restconf/data/Cisco-IOS-XE-process-cpu-oper:cpu-usage/cpu-utilization/five-seconds

# Juniper device - get system info
curl -X POST -u admin:123 http://localhost:8001/rpc/get-system-information

# Juniper device - get interfaces
curl -X POST -u admin:123 http://localhost:8001/rpc/get-interface-information
```

---

## Device Profiles

- **high_utilized**: CPU 80-95%, Memory 75-90% (with occasional drops)
- **average_utilized**: CPU 40-60%, Memory 50-65% (with occasional drops and spikes)
- **low_utilized**: CPU 10-20%, Memory 20-35% (with occasional spikes)
- **custom**: Behavior is driven by custom environment variables; CPU and RAM are generated from the same custom utilization profile and can include defined spikes and drops.
