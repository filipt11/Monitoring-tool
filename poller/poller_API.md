# Poller API Documentation

## Overview

The Poller API provides REST endpoints for managing network devices in the monitoring system. It handles device discovery, registration, deletion, and metadata management.

**Base URL**: `http://localhost:8000`

For full interactive API documentation, visit the **Swagger UI** at: `http://localhost:8000/docs`

---

## Quick Endpoint Reference

### Health & Status
- **GET** `/health` - API health check (no authentication required)

### Device Management
- **POST** `/api/device` - Add new device (with auto-discovery)
- **GET** `/api/devices` - List all devices (paginated)
- **GET** `/api/device/{id}` - Get device details
- **PATCH** `/api/device/{id}` - Update device info
- **POST** `/api/rediscover/{id}` - Rediscover device (refresh hostname/model)
- **DELETE** `/api/device/{id}` - Delete device

---

## Usage Examples

```bash
# Check API health
curl http://localhost:8000/health

# Get all devices
curl http://localhost:8000/api/devices

# Get specific device
curl http://localhost:8000/api/device/1

# Add device
curl -X POST http://localhost:8000/api/device \
  -H "Content-Type: application/json" \
  -d '{
    "ip": "127.0.0.1",
    "port": 8010,
    "vendor": "cisco",
    "username": "admin",
    "password": "password123",
    "https": false
  }'

# Update device credentials
curl -X PATCH http://localhost:8000/api/device/1 \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newadmin",
    "password": "newpassword"
  }'

# Rediscover device (refresh hostname & model)
curl -X POST http://localhost:8000/api/rediscover/1

# Delete device
curl -X DELETE http://localhost:8000/api/device/1
```


---

## Polling Behavior

Once a device is added:
1. Device info is stored in PostgreSQL
2. Poller service begins collecting metrics every 60 seconds
3. Metrics are stored in InfluxDB
4. Up to 50 devices polled concurrently (configurable)

### Monitored Metrics

**Cisco**: CPU usage, Memory utilization, Interface traffic  
**Juniper**: CPU usage, Memory utilization, Interface traffic


