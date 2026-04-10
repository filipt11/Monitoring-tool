from pydantic import BaseModel, Field, IPvAnyAddress
import requests
import datetime
from requests.auth import HTTPBasicAuth

class Config:
    """Allow Pydantic to read data from ORM objects"""
    from_attributes = True
    
# class Device:
#     """Class representing device to be polled
#     These objects are being selected from PostgreSQL"""
#     def __init__(self, ip, profile, hostname, vendor, model, username, password, port, https):
#         self.ip = ip
#         self.profile = profile
#         self.hostname = hostname
#         self.vendor = vendor
#         self.model = model
#         self.username = username
#         self.password = password
#         self.port = port
#         self.https = https

class Device(BaseModel):
    """Class representing device to be polled
    These objects are being selected from PostgreSQL"""
    ip: IPvAnyAddress
    profile: str
    hostname: str
    vendor: str
    model: str
    username: str
    password: str
    port: int = Field(gt=0, lt=65536)
    https: bool = False
    
        
# class DeviceWithPolledData(Device):
#     """Class represinting polled devices with its data
#     These objects are being saved to InfluxDB"""
#     def __init__(self, ip, profile, hostname, vendor, model, username, password, port, https, cpu, memory, ifIn, ifOut, ifInUtilization, ifOutUtilization):
#         """Override constructor to add polled metrics data"""
#         super().__init__(ip, profile, hostname, vendor, model, username, password, port, https)
#         self.cpu = cpu
#         self.memory = memory
#         self.ifIn = ifIn
#         self.ifOut = ifOut
#         self.ifInUtilization = ifInUtilization
#         self.ifOutUtilization = ifOutUtilization

class DeviceWithPolledData(Device):
    """Class represinting polled devices with its data
    These objects are being saved to InfluxDB"""
    cpu: int = Field(ge=0, le=100)
    memory: int = Field(ge=0)
    ifIn: int
    ifOut: int
    ifInUtilization: float
    ifOutUtilization: float

def get_current_devices():
    """Connect to postgreSQL and gather newest devices data required to polling"""
    devices = []
    
    # Real connecting to DB will be added
    
    devices.append(Device("127.0.0.2", "high_utilized", "r-high-1", "cisco", "Catalyst 9000", "admin", "123", 443, False))
    devices.append(Device("127.0.0.3", "low_utilized", "r-low-1", "cisco", "Catalyst 9000", "admin", "123", 443, False))
    devices.append(Device("127.0.0.4", "standard", "r-avg-1", "cisco", "Catalyst 9000", "admin", "123", 443, False))
    
    # Inventory logs to be added there
    
    return devices
    
   
def poll_devices():
    device_list = get_current_devices()
    for device in device_list:
        if device.vendor == "cisco":
            poll_cisco_device(device)
        elif device.vendor == "juniper":
            poll_juniper_device(device)
            

def poll_cisco_device(device):
    protocol = "https" if device.https else "http"
    base_url = f"{protocol}://{device.ip}:{device.port}"
    
    cpu_path = "/restconf/data/Cisco-IOS-XE-process-cpu-oper:cpu-usage/cpu-utilization/five-seconds"
    memory_path = "/restconf/data/Cisco-IOS-XE-memory-oper:memory-statistics"
    interface_path = "/restconf/data/ietf-interfaces:interfaces-state"
    
    full_cpu_url = f"{base_url}{cpu_path}"
    full_memory_url = f"{base_url}{memory_path}"
    full_interface_url = f"{base_url}{interface_path}"
    
    headers = {
        "Accept": "application/yang-data+json",
        "Content-Type": "application/yang-data+json"
    }
    
    try:
        cpu_response = requests.get(
            full_cpu_url, 
            auth=HTTPBasicAuth(device.username, device.password),
            headers=headers,
            verify=False, 
            timeout=10
        )
        
        cpu_response.raise_for_status()
        
        
    except Exception as e:
        pass
    
    
    
    

def poll_juniper_device(device):
    pass

def save_polled_data(device):
    pass

poll_devices()