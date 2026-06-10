# Monitoring Tool

## Overview

**Monitoring Tool** is a comprehensive network device monitoring solution designed to collect and store performance metrics from Cisco IOS XE and Juniper devices through their API. The system architecture consists of three main components:

- **Device Simulator**: Simulates Cisco and Juniper network devices with realistic performance metrics (CPU, memory, interface statistics)
- **Poller Service**: Discovers, manages, and continuously polls real or simulated network devices, saving collected data to InfluxDB
- **Web application (To be done)**: GUI application visualizing collected data on charts, tables etc.

The tool provides a REST API for device management and uses Docker Compose for simplified deployment of infrastructure components.

### Key Features

- **Multi-Vendor Support**: Seamlessly handles both Cisco IOS XE and Juniper devices
- **REST API**: Comprehensive APIs for device management
- **Real-time Monitoring**: Continuous polling of device metrics with configurable intervals
- **Scalable Architecture**: Asynchronous polling capable of handling thousands of devices simultaneously.
- **Device Profiles**: Simulated devices with different utilization profiles (high, average, low)

---

## Documentation

### Complete Source Code documentation is available in HTML format: [Documentation](https://filipt11.github.io/Monitoring-tool/index.html)

## API Documentation

### Poller API
Documentation for device management endpoints: [Poller API](poller/poller_API.md)

### Simulator API
Documentation for simulated device endpoints: [Simulator API](simulator/simulator_API.md)

---

## Requirements

### System Requirements
- **Python**: 3.10 or higher
- **Docker**: 20.10 or higher
- **Docker Compose**: 2.0 or higher

### Python Dependencies
Packages required to manually run:
- `fastapi`
- `sqlalchemy`
- `influxdb-client`
- `httpx`
- `uvicorn`
- `loguru`
- `psycopg2-binary`
- `fastapi-pagination`
- `pydantic`
- `typing_extensions`
- `websockets`

---

## Quick Start

### Note: remember that docker deamon must be running

### Option 1: Using the Startup Script (Recommended)

```bash
# Navigate to project root
cd /path/to/monitoring-tool

# Run the startup script

# Linux/macOS
python run.py

# Windows
# py run.py
```

The script will:
1. Start Docker containers (simulator, PostgreSQL, InfluxDB)
2. Create Python virtual environment
3. Install required dependencies
4. Start the poller service and API server
5. Begin polling simulated devices

---

### Option 2: Manual Setup (for Linux/macOS)

#### Step 1: Start Docker Services

```bash
# Note that docker commands might require sudo rights

# Start Simulator
cd simulator
docker-compose -f docker-compose.yml up -d

# Start Poller Infrastructure
cd poller
docker-compose -f docker-compose.yml up -d
```

#### Step 2: Set Up Python Environment

```bash
# Create and activate virtual environment (Alternatively, you can install required packages directly into your system)
cd poller
python -m venv venv

# Activate venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### Step 3: Start the Poller API Server

```bash
# In terminal with venv activated
cd /path/to/monitoring-tool/poller
python api.py

# API server will start on: http://localhost:8000
```

#### Step 4: Start the Polling Service

```bash
#In second terminal (with venv activated too)
cd /path/to/monitoring-tool/poller
python main.py

# Polling service will begin collecting metrics from devices
```

---

## Verification

### Check Example Simulated Device Health

```bash
# For Cisco device simulator (requires auth)
curl -u admin:123 http://localhost:8001/restconf/data/health
```

### Check Poller API Health

```bash
curl http://localhost:8000/health
```

### View Stored Devices

```bash
curl http://localhost:8000/api/devices
```

### Access InfluxDB Dashboards and APIs

**InfluxDB Data Visualization**
- URL: http://localhost:8086
- Login credentials: `admin` / `adminpassword123`
- Here you can view charts and graphs with collected performance metrics from monitored devices

**Device Simulator Swagger Documentation**
- URL: http://localhost:8001/docs
- Access comprehensive API documentation for the simulated devices endpoints

**Poller Swagger Documentation**
- URL: http://localhost:8000/docs
- Access comprehensive API documentation for device management and monitoring endpoints

---



## Environment Configuration

### Simulator Configuration

Set these environment variables before running the simulator:

```bash
export DEVICE_PROFILE=average_utilized    # Options: high_utilized, average_utilized, low_utilized
export DEVICE_IP=0.0.0.0                 # Device IP address
export DEVICE_HOSTNAME=s-cisco-1         # Device hostname
export DEVICE_VENDOR=cisco               # Options: cisco, juniper
export DEVICE_MODEL="Catalyst 9000"      # Device model name
export DEVICE_USERNAME=admin             # Credentials for API access
export DEVICE_PASSWORD=123
export DEVICE_PORT=8001                  # Port for device API (default: 8001)
export DEVICE_IS_HTTPS=false              # Use HTTP (false=HTTP, true=HTTPS)
```

### Adding New Simulated Devices

To create additional simulated devices beyond the default ones, set environment variables before starting the simulator:

```bash
export DEVICE_IP=127.0.0.1              # IP address of the simulated device
export DEVICE_PORT=8008                     # Port number
export DEVICE_HOSTNAME=my-device-1          # Unique hostname
export DEVICE_VENDOR=cisco                  # Vendor: cisco or juniper
export DEVICE_MODEL="ISR 4451"              # Device model
export DEVICE_PROFILE=average_utilized      # Utilization: high_utilized, average_utilized, low_utilized
export DEVICE_USERNAME=admin                # API username
export DEVICE_PASSWORD=password123          # API password
export DEVICE_IS_HTTPS=false                 # Use HTTP (set true for HTTPS)
```

Then start the simulator with these variables set, and it will create a new device with the specified configuration.

### Adding Devices to Monitoring

Once you have created simulated devices or have access to real Cisco/Juniper devices, add them to the poller service:

1. **Using the Poller API**:
```bash
curl -X POST http://localhost:8000/api/device \
  -H "Content-Type: application/json" \
  -d '{
    "ip": "192.168.1.100",
    "port": 8443,
    "vendor": "cisco",
    "username": "admin",
    "password": "password123",
    "enabled": true
  }'
```

2. **View Added Devices**:
```bash
curl http://localhost:8000/api/devices
```
(This endpoint returns paginated results: add `?page=1&size=50` for pagination control)

**Note**: You can add devices from:
- Simulated devices (Device Simulator)
- Real Cisco IOS XE devices
- Real Juniper devices
- Cisco/Juniper vendor simulators

The poller will automatically detect the device type and apply appropriate polling strategies for each vendor.

### Poller Configuration

Configuration is managed in `poller/config.py`. Key settings and environment variables:

**API & Polling Settings:**
- `API_PORT=8000` - Port for the API server
- `POLLING_INTERVAL=60` - Seconds between polls per device  
- `MAX_DEVICES=50` - Maximum concurrent device polling tasks

**PostgreSQL Settings:**
- `POSTGRES_URL` - Connection string (default: `postgresql://admin:123@localhost:5432/inventory`)
- `POSTGRES_USER` - Database user (default: `admin`)
- `POSTGRES_PASSWORD` - Database password (default: `123`)

**InfluxDB Settings:**
- `INFLUX_URL` - InfluxDB server (default: `http://localhost:8086`)
- `INFLUX_TOKEN` - API token (default: `secret_token`)
- `INFLUX_ORG` - Organization name (default: `my_org`)
- `INFLUX_BUCKET` - Data bucket (default: `network_metrics`)

---

### Viewing Logs

```bash
# Poller API logs
tail -f poller/api.log

# Polling logs
tail -f poller/poller.log

# Discovery logs
tail -f poller/discovery.log

# Check Docker logs
docker logs -f <service_name>
```

