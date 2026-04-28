from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from influxdb_client import InfluxDBClient
from influxdb_client.client.write_api import SYNCHRONOUS
from loguru import logger

# Specify polling interval
POLLING_INERVAL = 60


# PostgreSQL config
class Base(DeclarativeBase):
    pass


engine = create_engine("postgresql://admin:123@localhost:5432/inventory")
Session = sessionmaker(bind=engine)


def init_db():
    """Initalizing Connection with Postgres DB"""

    try:
        Base.metadata.create_all(engine)
        logger.success("Successfully initialized Postgres DB")
    except Exception as e:
        logger.error(f"Database error: {e}")
        raise ConnectionError


# InfluxDB config
INFLUX_URL = "http://localhost:8086"
INFLUX_TOKEN = "secret_token"
INFLUX_ORG = "my_org"
INFLUX_BUCKET = "network_metrics"

influx_client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)

write_api = influx_client.write_api(write_options=SYNCHRONOUS)
