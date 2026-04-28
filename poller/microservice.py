from config import (
    engine,
    Base,
    Session,
    influx_client,
    INFLUX_ORG,
    INFLUX_BUCKET,
    write_api,
    init_db,
)
from loguru import logger
from models import Device, DeviceCreate, DeviceOut, DeviceUpdate
from fastapi import APIRouter, FastAPI, Depends, HTTPException, status
import uvicorn
from influxdb_client import Point
from influxdb_client.client.write_api import SYNCHRONOUS
from fastapi.security import HTTPBasic, HTTPBasicCredentials
import requests
from requests.auth import HTTPBasicAuth
from cisco_polling import fetch_data
from sys import stderr
from sqlalchemy.exc import IntegrityError
from fastapi_pagination import Page, add_pagination, paginate
from fastapi_pagination.ext.sqlalchemy import paginate

# Configure Logging
logger.remove()
logger.add(stderr, level="INFO")
logger.add("discovery.log", rotation="10 MB", retention="10 days", level="INFO")

# Define microservice port
PORT = 8000

app = FastAPI()
add_pagination(app)


def model_cisco_device_info(
    ip: str, port: int, username: str, password: str, https: bool
) -> tuple[str, str]:
    """Try connect to device and perform basic modeling"""

    protocol = "https" if https else "http"
    hostname_url = (
        f"{protocol}://{ip}:{port}/restconf/data/Cisco-IOS-XE-native:native/hostname"
    )
    model_url = f"{protocol}://{ip}:{port}/restconf/data/Cisco-IOS-XE-device-hardware-oper:device-hardware-data/device-hardware/device-inventory"
    hostname = "Unknown"
    model = "Unknown"

    try:
        hostname_raw = fetch_data(hostname_url, username, password)
        model_raw = fetch_data(model_url, username, password)

        hostname = hostname_raw.get("Cisco-IOS-XE-native:hostname", "Unknown")
        inventory_list = model_raw.get(
            "Cisco-IOS-XE-device-hardware-oper:device-inventory", []
        )

        if inventory_list:
            model = inventory_list[0].get("hw-description", "Unknown").strip()

    except Exception as e:
        logger.error(f"Error during modeling device: {ip}: {e}")
        raise ConnectionError(f"Error during modeling device: {ip}")

    return hostname, model


@app.get("/health")
async def health():
    """Return status 'OK' if API started correctly."""

    return {"status:": "OK"}


@app.post("/api/device", status_code=201)
async def add_device(device_in: DeviceCreate):
    try:
        hostname, model = model_cisco_device_info(
            device_in.ip,
            device_in.port,
            device_in.username,
            device_in.password,
            device_in.https,
        )
    except ConnectionError as e:
        # Return 400 if device not responds
        raise HTTPException(status_code=400, detail=str(e))

    try:
        with Session() as db:
            with db.begin():
                new_device = Device(
                    ip=device_in.ip,
                    port=device_in.port,
                    vendor=device_in.vendor,
                    username=device_in.username,
                    password=device_in.password,
                    hostname=hostname,
                    model=model,
                    https=device_in.https,
                )
                db.add(new_device)

            db.refresh(new_device)
            logger.success(f"Successfully created device: {hostname} | {device_in.ip}")
            return {"status": "created", "device": new_device}

    except IntegrityError as e:
        # Device already exists in Database
        logger.warning(f"Device already exists: {device_in.ip}:{device_in.port} | {e}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Device: {device_in.ip}:{device_in.port} already exists in database.",
        )

    except Exception as e:
        # Catch other DB error
        logger.error(f"Database error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal database error occurred.",
        )


@app.delete("/api/device/{id}", status_code=200)
async def delete_device(id: int):
    try:
        with Session() as db:
            device = db.query(Device).filter(Device.id == id).first()
            if not device:
                logger.warning(f"Attempted to delete non-existing device with ID: {id}")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Not found device with ID: {id}.",
                )

            db.delete(device)
            db.commit()

            logger.success(f"Successfully deleted device with ID: {id}")
            return {"status": "deleted", "message": "Successfully deleted device"}

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal database error occurred.",
        )


@app.post("/api/rediscover/{id}")
async def rediscover_device(id: int):
    try:
        with Session() as db:
            device = db.query(Device).filter(Device.id == id).first()

            if not device:
                logger.warning(
                    f"Attempted to rediscover non-existing device with ID: {id}"
                )
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Not found device with ID: {id}.",
                )

            hostname, model = model_cisco_device_info(
                device.ip, device.port, device.username, device.password, device.https
            )

            device.hostname = hostname
            device.model = model

            db.commit()
            logger.success(
                f"Successfully rediscovered device: {hostname} | {device.ip}"
            )
            return {"status": "updated", "device": device}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Rediscover failed: {e}")
        raise HTTPException(status_code=500, detail="Internal database error occurred.")


@app.get("/api/device/{id}", response_model=DeviceOut)
async def get_device(id: int):
    with Session() as db:
        device = db.query(Device).filter(Device.id == id).first()
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Not found device with ID: {id} ",
            )
        return device


@app.get("/api/devices", response_model=Page[DeviceOut])
async def get_devices():
    with Session() as db:
        query = db.query(Device).order_by(Device.id.asc())
        return paginate(db, query)


@app.patch("/api/device/{id}", response_model=DeviceOut)
async def update_device(id: int, device_update: DeviceUpdate):
    with Session() as db:
        with db.begin():
            device = db.query(Device).filter(Device.id == id).first()

            if not device:
                raise HTTPException(status_code=404, detail="Device not found")

            update_data = device_update.model_dump(exclude_unset=True)

            for key, value in update_data.items():
                setattr(device, key, value)

        db.refresh(device)
        logger.info(f"Successfully updated device: {device.hostname} |  {device.ip}")
        return device


def main():
    """Connect to DB and start uvicorn server"""

    init_db()
    uvicorn.run(app, host="0.0.0.0", port=PORT)


if __name__ == "__main__":
    main()
