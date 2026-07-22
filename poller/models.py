from datetime import datetime, timezone

from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import DateTime, ForeignKey, String, Integer, BigInteger, Boolean, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .config import Base
from typing import Optional
from typing import TypedDict


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Device(Base):
    """SQLAlchemy model representing a network device stored in the database."""

    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    hostname: Mapped[str] = mapped_column(String(100), nullable=False)
    ip: Mapped[str] = mapped_column(String(64), nullable=False)
    vendor: Mapped[str] = mapped_column(String(50), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=True)
    username: Mapped[str] = mapped_column(String(50), nullable=False)
    password: Mapped[str] = mapped_column(String(100), nullable=False)
    port: Mapped[int] = mapped_column(Integer)
    https: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        server_default=func.now(),
        nullable=True,
    )

    __table_args__ = (UniqueConstraint("ip", "port", name="_ip_port_uc"),)

    interfaces: Mapped[list["Interface"]] = relationship(
        back_populates="device",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Interface(Base):
    """SQLAlchemy model representing a network interface discovered on a device."""

    __tablename__ = "interfaces"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    device_id: Mapped[int] = mapped_column(
        ForeignKey("devices.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    if_index: Mapped[int] = mapped_column(Integer, nullable=False)
    mac: Mapped[str | None] = mapped_column(String(64), nullable=True)
    speed_bps: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    admin_status: Mapped[str | None] = mapped_column(String(10), nullable=True)
    oper_status: Mapped[str | None] = mapped_column(String(10), nullable=True)
    discovered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    device: Mapped["Device"] = relationship(back_populates="interfaces")

    __table_args__ = (
        UniqueConstraint("device_id", "if_index", name="_device_if_index_uc"),
    )


class InterfaceOut(BaseModel):
    """Pydantic model used for API responses containing interface details."""

    id: int
    device_id: int
    name: str
    if_index: int
    mac: str | None = None
    speed_bps: int | None = None
    admin_status: str | None = None
    oper_status: str | None = None
    discovered_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DeviceWithPolledData(BaseModel):
    """Pydantic model representing a device with polling metrics for InfluxDB."""

    id: int
    hostname: str
    ip: str
    cpu_usage: Optional[int] = Field(None, ge=0, le=100)
    memory_total: Optional[int] = Field(None, ge=0)
    memory_usage: Optional[int] = Field(None, ge=0)
    memory_usage_pct: Optional[float] = Field(None, ge=0, le=100)


class DeviceCreate(BaseModel):
    """Pydantic model for device creation requests."""

    ip: str
    port: int
    vendor: str
    username: str
    password: str
    https: bool


class DeviceOut(BaseModel):
    """Pydantic model used for API responses containing device details."""

    id: int
    ip: str
    hostname: str
    vendor: str
    model: str
    port: int | None = Field(default=None, ge=1, le=65535)
    username: str
    password: str
    https: bool
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class DeviceUpdate(BaseModel):
    """Pydantic model for partial device updates."""

    port: Optional[int] = Field(None, ge=1, le=65535)
    username: Optional[str] = None
    password: Optional[str] = None
    https: Optional[bool] = None


class InterfaceData(TypedDict):
    """TypedDict describing interface counters and state returned by polling."""

    name: str
    if_index: int
    in_octets: int
    out_octets: int
    speed: int
    admin_status: str
    oper_status: str
    mac: str


class PollingResult(TypedDict):
    """TypedDict describing the polling result returned from device polling."""

    status: str
    cpu: int | None
    total_memory: int | None
    used_memory: int | None
    memory_pct: float | None
    interfaces: list[InterfaceData]
