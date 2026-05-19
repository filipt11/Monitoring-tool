from config import Session, engine
import models
from loguru import logger


def seed_devices():
    initial_devices = [
        {
            "ip": "127.0.0.1",
            "hostname": "r-high-1",
            "vendor": "cisco",
            "model": "Catalyst 9000",
            "username": "admin",
            "password": "123",
            "port": 8001,
            "https": False,
        },
        {
            "ip": "127.0.0.1",
            "hostname": "r-low-1",
            "vendor": "cisco",
            "model": "Catalyst 9000x",
            "username": "admin",
            "password": "123",
            "port": 8002,
            "https": False,
        },
        {
            "ip": "127.0.0.1",
            "hostname": "r-avg-1",
            "vendor": "cisco",
            "model": "Catalyst 8000",
            "username": "admin",
            "password": "123",
            "port": 8003,
            "https": False,
        },
                {
            "ip": "127.0.0.1",
            "hostname": "r-junos-avg-1",
            "vendor": "juniper",
            "model": "ACX5400",
            "username": "admin",
            "password": "123",
            "port": 8004,
            "https": False,
        },
        {
            "ip": "127.0.0.1",
            "hostname": "r-junos-2",
            "vendor": "juniper",
            "model": "EX4200",
            "username": "admin",
            "password": "123",
            "port": 8005,
            "https": False,
        },
        {
            "ip": "127.0.0.1",
            "hostname": "s-low-2",
            "vendor": "juniper",
            "model": "EX400",
            "username": "admin",
            "password": "123",
            "port": 8006,
            "https": False,
        },
    ]

    with Session() as session:
        for dev_data in initial_devices:
            exists = (
                session.query(models.Device)
                .filter_by(hostname=dev_data["hostname"])
                .first()
            )

            if not exists:
                new_dev = models.Device(**dev_data)
                session.add(new_dev)
                logger.success(f"Device has been created: {dev_data['hostname']}")
            else:
                logger.info(f"Device already exists: {dev_data['hostname']}")

        session.commit()
