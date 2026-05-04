from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import String, Integer, Boolean, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from config import Base
from typing import Optional
from typing import TypedDict


class Device(Base):
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

    __table_args__ = (UniqueConstraint("ip", "port", name="_ip_port_uc"),)

    def __repr__(self) -> str:
        return f"<Device(hostname={self.hostname}, ip={self.ip}, vendor={self.vendor})>"


class DeviceWithPolledData(BaseModel):
    """Class represinting polled devices with its data
    These objects are being saved to InfluxDB."""

    id: int
    hostname: str
    ip: str
    cpu_usage: Optional[int] = Field(None, ge=0, le=100)
    memory_total: Optional[int] = Field(None, ge=0)
    memory_usage: Optional[int] = Field(None, ge=0)
    memory_usage_pct: Optional[float] = Field(None, ge=0, le=100)


class DeviceCreate(BaseModel):
    ip: str
    port: int
    vendor: str
    username: str
    password: str
    https: bool


class DeviceOut(BaseModel):
    id: int
    ip: str
    hostname: str
    vendor: str
    model: str
    port: int | None = Field(default=None, ge=1, le=65535)
    username: str
    password: str
    https: bool

    model_config = ConfigDict(from_attributes=True)


class DeviceUpdate(BaseModel):
    port: Optional[int] = Field(None, ge=1, le=65535)
    username: Optional[str] = None
    password: Optional[str] = None
    https: Optional[bool] = None


class PollingResult(TypedDict):
    status: str
    cpu: int | None
    total_memory: int | None
    used_memory: int | None
    memory_pct: float | None
    interfaces: list[InterfaceData]


class InterfaceData(TypedDict):
    name: str
    if_index: int
    in_octets: int
    out_octets: int
    speed: int
    admin_status: str
    oper_status: str
    mac: str
