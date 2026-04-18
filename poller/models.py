from pydantic import BaseModel, Field, IPvAnyAddress
from sqlalchemy import String, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from config import Base

# class Device(BaseModel):
#     """Class representing device to be polled
#     These objects are being selected from PostgreSQL"""

#     # __tablename__ = "devices"

#     id: int
#     ip: IPvAnyAddress
#     profile: str
#     hostname: str
#     vendor: str
#     model: str
#     username: str
#     password: str
#     port: int = Field(gt=0, lt=65536)
#     https: bool = False


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    hostname: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    ip: Mapped[str] = mapped_column(String(64), nullable=False)
    vendor: Mapped[str] = mapped_column(String(50), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=True)
    username: Mapped[str] = mapped_column(String(50), nullable=False)
    password: Mapped[str] = mapped_column(String(100), nullable=False)
    port: Mapped[int] = mapped_column(Integer)
    https: Mapped[bool] = mapped_column(Boolean, default=False)

    def __repr__(self) -> str:
        return f"<Device(hostname={self.hostname}, ip={self.ip}, vendor={self.vendor})>"


class DeviceWithPolledData(Device):
    """Class represinting polled devices with its data
    These objects are being saved to InfluxDB"""

    cpu_usage: int = Field(ge=0, le=100)
    memory_total: int = Field(ge=0)
    memory_usage: int = Field(ge=0)
    memory_usage_pct: float = Field(ge=0, le=100)


class InterfaceData(BaseModel):
    """summary"""

    name: str
    type: str
    speed_bps: int
    admin_status: str
    oper_status: str
    # Counters
    in_octets: int
    out_octets: int
    # Calculated speed
    in_bps: float
    out_bps: float
    # Calculated utilization in %
    utilization_in: float
    utilization_out: float
