from sqlalchemy import Engine, create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from influxdb_client import InfluxDBClient
from influxdb_client.client.write_api import SYNCHRONOUS
from loguru import logger

# Specify polling interval
POLLING_INERVAL = 300

# Specify max number of devices polled in once
MAX_DEVICES = 50

# Specify API port
API_PORT = 8000


# PostgreSQL config
class Base(DeclarativeBase):
    pass


engine: Engine = create_engine("postgresql://admin:123@localhost:5432/applicationdb")
Session = sessionmaker(bind=engine)


def _migrate_interfaces_speed_bps_to_bigint() -> None:
    """Widen speed_bps — 8G+ interfaces exceed PostgreSQL INTEGER max (~2.1B)."""

    inspector = inspect(engine)
    if not inspector.has_table("interfaces"):
        return

    columns = {column["name"]: column for column in inspector.get_columns("interfaces")}
    speed_column = columns.get("speed_bps")
    if speed_column is None:
        return

    column_type = str(speed_column["type"]).upper()
    if "BIGINT" in column_type:
        return

    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE interfaces ALTER COLUMN speed_bps TYPE BIGINT")
        )

    logger.info("Migrated interfaces.speed_bps column to BIGINT")


def _migrate_devices_created_at() -> None:
    """Add created_at to devices for monitoring UI display."""

    inspector = inspect(engine)
    if not inspector.has_table("devices"):
        return

    columns = {column["name"] for column in inspector.get_columns("devices")}

    with engine.begin() as connection:
        if "created_at" not in columns:
            connection.execute(
                text("ALTER TABLE devices ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW()")
            )
            logger.info("Added devices.created_at column")
        else:
            connection.execute(
                text("ALTER TABLE devices ALTER COLUMN created_at SET DEFAULT NOW()")
            )
            logger.info("Ensured devices.created_at default is NOW()")


def _migrate_drop_interfaces_last_seen_at() -> None:
    """Remove unused last_seen_at column from interfaces."""

    inspector = inspect(engine)
    if not inspector.has_table("interfaces"):
        return

    columns = {column["name"] for column in inspector.get_columns("interfaces")}
    if "last_seen_at" not in columns:
        return

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE interfaces DROP COLUMN last_seen_at"))

    logger.info("Dropped interfaces.last_seen_at column")


def init_db() -> None:
    """Initalizing Connection with Postgres DB"""

    import poller.models  # noqa: F401

    try:
        Base.metadata.create_all(engine)
        _migrate_interfaces_speed_bps_to_bigint()
        _migrate_devices_created_at()
        _migrate_drop_interfaces_last_seen_at()
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
