from pydantic import BaseModel, Field, IPvAnyAddress

class Device(BaseModel):
    """Class representing device to be polled
    These objects are being selected from PostgreSQL"""
    id: int
    ip: IPvAnyAddress
    profile: str
    hostname: str
    vendor: str
    model: str
    username: str
    password: str
    port: int = Field(gt=0, lt=65536)
    https: bool = False
    

class DeviceWithPolledData(Device):
    """Class represinting polled devices with its data
    These objects are being saved to InfluxDB"""
    cpu_usage: int = Field(ge=0, le=100)
    memory_total: int = Field(ge=0)
    memory_usage: int = Field(ge=0)
    memory_usage_pct : float = Field(ge=0, le=100)
    

class InterfaceData(BaseModel):
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