from config import Session, engine
import models
from loguru import logger


def seed_devices():
    initial_devices = [
        {
            "ip": "127.0.0.2",
            "hostname": "r-high-1",
            "vendor": "cisco",
            "model": "Catalyst 9000",
            "username": "admin",
            "password": "123",
            "port": 443,
            "https": False,
        },
        {
            "ip": "127.0.0.3",
            "hostname": "r-low-1",
            "vendor": "cisco",
            "model": "Catalyst 9000",
            "username": "admin",
            "password": "123",
            "port": 443,
            "https": False,
        },
        {
            "ip": "127.0.0.4",
            "hostname": "r-avg-1",
            "vendor": "cisco",
            "model": "Catalyst 9000",
            "username": "admin",
            "password": "123",
            "port": 443,
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
                logger.info(f"Device has been created: {dev_data['hostname']}")
            else:
                logger.info(f"Device already exists: {dev_data['hostname']}")

        session.commit()
