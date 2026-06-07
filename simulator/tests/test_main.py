from simulator import devices, main
import importlib
from fastapi import HTTPException
from fastapi.security import HTTPBasicCredentials
from fastapi.testclient import TestClient
import pytest


def test_device_initialization_low_utilized_juniper(monkeypatch):
    # Set environment variables to create LowUtilizedJuniperDevice
    monkeypatch.setenv("DEVICE_VENDOR", "juniper")
    monkeypatch.setenv("DEVICE_PROFILE", "low_utilized")
    
    importlib.reload(main)
    
    assert isinstance(main.device, devices.LowUtilizedJuniperDevice)


def test_device_initialization_high_utilized_cisco(monkeypatch):
    # Set environment variables to create HighUtilizedCiscoDevice
    monkeypatch.setenv("DEVICE_VENDOR", "cisco")
    monkeypatch.setenv("DEVICE_PROFILE", "high_utilized")
    
    importlib.reload(main)
    
    assert isinstance(main.device, devices.HighUtilizedCiscoDevice)


def test_device_initialization_default(monkeypatch):
    # Clear environment variables to get default device
    monkeypatch.delenv("DEVICE_VENDOR", raising=False)
    monkeypatch.delenv("DEVICE_PROFILE", raising=False)
    
    importlib.reload(main)
    
    assert isinstance(main.device, devices.BaseCiscoDevice)


def test_device_initialization_average_utilized_cisco(monkeypatch):
    # Set environment variables to create AverageUtilizedCiscoDevice
    monkeypatch.setenv("DEVICE_VENDOR", "cisco")
    monkeypatch.setenv("DEVICE_PROFILE", "average_utilized")
    
    importlib.reload(main)
    
    assert isinstance(main.device, devices.AverageUtilizedCiscoDevice)


def test_device_initialization_average_utilized_juniper(monkeypatch):
    # Set environment variables to create AverageUtilizedJuniperDevice
    monkeypatch.setenv("DEVICE_VENDOR", "juniper")
    monkeypatch.setenv("DEVICE_PROFILE", "average_utilized")
    
    importlib.reload(main)
    
    assert isinstance(main.device, devices.AverageUtilizedJuniperDevice)


def test_device_initialization_high_utilized_juniper(monkeypatch):
    # Set environment variables to create HighUtilizedJuniperDevice
    monkeypatch.setenv("DEVICE_VENDOR", "juniper")
    monkeypatch.setenv("DEVICE_PROFILE", "high_utilized")
    
    importlib.reload(main)
    
    assert isinstance(main.device, devices.HighUtilizedJuniperDevice)


def test_device_initialization_unknown_profile(monkeypatch):
    # Set environment variables to an unknown profile
    monkeypatch.setenv("DEVICE_VENDOR", "cisco")
    monkeypatch.setenv("DEVICE_PROFILE", "unknown_profile")
    
    importlib.reload(main)
    
    # Should fall back to default device
    assert isinstance(main.device, devices.BaseCiscoDevice)


def test_device_initialization_unknown_vendor(monkeypatch):
    # Set environment variables to an unknown vendor
    monkeypatch.setenv("DEVICE_VENDOR", "unknown_vendor")
    monkeypatch.setenv("DEVICE_PROFILE", "high_utilized")
    
    importlib.reload(main)
    
    # Should fall back to default device
    assert isinstance(main.device, devices.BaseCiscoDevice)


def test_device_initialization_unknown_vendor_and_profile(monkeypatch):
    # Set environment variables to unknown vendor and profile
    monkeypatch.setenv("DEVICE_VENDOR", "unknown_vendor")
    monkeypatch.setenv("DEVICE_PROFILE", "unknown_profile")
    
    importlib.reload(main)
    
    # Should fall back to default device
    assert isinstance(main.device, devices.BaseCiscoDevice)

def test_device_initialization_case_insensitivity(monkeypatch):
    # Set environment variables with different cases
    monkeypatch.setenv("DEVICE_VENDOR", "CISCO")
    monkeypatch.setenv("DEVICE_PROFILE", "HIGH_UTILIZED")
    
    importlib.reload(main)
    
    assert isinstance(main.device, devices.HighUtilizedCiscoDevice)


def test_device_initialization_partial_profile_name(monkeypatch):
    # Set environment variables with partial profile name
    monkeypatch.setenv("DEVICE_VENDOR", "cisco")
    monkeypatch.setenv("DEVICE_PROFILE", "high")
    
    importlib.reload(main)
    
    # Should fall back to default device since profile name doesn't match exactly
    assert isinstance(main.device, devices.BaseCiscoDevice)


def test_device_initialization_partial_vendor_name(monkeypatch):
    # Set environment variables with partial vendor name
    monkeypatch.setenv("DEVICE_VENDOR", "cis")
    monkeypatch.setenv("DEVICE_PROFILE", "high_utilized")
    
    importlib.reload(main)
    
    # Should fall back to default device since vendor name doesn't match exactly
    assert isinstance(main.device, devices.BaseCiscoDevice)


def test_device_initialization_empty_profile(monkeypatch):
    # Set environment variables with empty profile
    monkeypatch.setenv("DEVICE_VENDOR", "cisco")
    monkeypatch.setenv("DEVICE_PROFILE", "")
    
    importlib.reload(main)
    
    # Should fall back to default device
    assert isinstance(main.device, devices.BaseCiscoDevice)


def test_device_initialization_empty_vendor(monkeypatch):
    # Set environment variables with empty vendor
    monkeypatch.setenv("DEVICE_VENDOR", "")
    monkeypatch.setenv("DEVICE_PROFILE", "high_utilized")
    
    importlib.reload(main)
    
    # Should fall back to default device
    assert isinstance(main.device, devices.BaseCiscoDevice)


def test_authenticate_success(monkeypatch):
    # Valid credentials should return the username
    monkeypatch.setenv("DEVICE_USERNAME", "admin")
    monkeypatch.setenv("DEVICE_PASSWORD", "123")

    importlib.reload(main)

    credentials = HTTPBasicCredentials(username="admin", password="123")
    assert main.authenticate(credentials) == "admin"


def test_authenticate_failed(monkeypatch):
    # Invalid credentials should raise HTTPException with 401 status code
    monkeypatch.setenv("DEVICE_USERNAME", "admin")
    monkeypatch.setenv("DEVICE_PASSWORD", "123")

    importlib.reload(main)

    credentials = HTTPBasicCredentials(username="haker", password="999")
    with pytest.raises(HTTPException) as exc_info:
        main.authenticate(credentials)
    assert exc_info.value.status_code == 401


def test_cisco_router_active_juniper_inactive(monkeypatch):
    # Routing logic should return 401 for Cisco endpoint and 404 for Juniper endpoint
    monkeypatch.setenv("DEVICE_VENDOR", "cisco")
    importlib.reload(main)

    client = TestClient(main.app) 

    response_cisco = client.get("/restconf/data/health")
    assert response_cisco.status_code == 401 

    response_juniper = client.post("/rpc/get-system-information")
    assert response_juniper.status_code == 404


def test_juniper_router_active_cisco_inactive(monkeypatch):
    # Routing logic should return 401 for Juniper endpoint and 404 for Cisco endpoint
    monkeypatch.setenv("DEVICE_VENDOR", "juniper")

    importlib.reload(main)
    client = TestClient(main.app) 

    response_juniper = client.post("/rpc/get-system-information")
    assert response_juniper.status_code == 401 

    response_cisco = client.get("/restconf/data/health")
    assert response_cisco.status_code == 404



def test_get_health_endpoint(monkeypatch):
    # Ensure the health endpoint returns 200 OK
    monkeypatch.setenv("DEVICE_VENDOR", "cisco")
    importlib.reload(main)

    client = TestClient(main.app)
    response = client.get("/restconf/data/health", auth=("admin", "123"))

    assert response.status_code == 200


def test_get_cpu_cisco_endpoint(monkeypatch):
    # Stub the get_cpu method to return a specific value and test the endpoint
    monkeypatch.setenv("DEVICE_VENDOR", "cisco")
    importlib.reload(main)

    client = TestClient(main.app)
    monkeypatch.setattr(main.device, "get_cpu", lambda: 45)
    response = client.get(
        "/restconf/data/Cisco-IOS-XE-process-cpu-oper:cpu-usage/cpu-utilization/five-seconds",
        auth=("admin", "123")
    )

    assert response.status_code == 200


def test_get_memory_cisco_endpoint(monkeypatch):
    # Stub the get_used_memory method to return a specific value and test the endpoint
    monkeypatch.setenv("DEVICE_VENDOR", "cisco")
    importlib.reload(main)

    client = TestClient(main.app)
    monkeypatch.setattr(main.device, "get_used_memory", lambda: 2048)
    response = client.get(
        "/restconf/data/Cisco-IOS-XE-memory-oper:memory-statistics",
        auth=("admin", "123")
    )

    assert response.status_code == 200


def test_get_interfaces_cisco_endpoint(monkeypatch):
    # Stub the get_interfaces method to return a 200 status code and test the endpoint
    monkeypatch.setenv("DEVICE_VENDOR", "cisco")
    importlib.reload(main)

    client = TestClient(main.app)
    response = client.get(
        "/restconf/data/ietf-interfaces:interfaces-state",
        auth=("admin", "123")
    )

    assert response.status_code == 200


def test_get_hostname_cisco_endpoint(monkeypatch):
    # Stub the get_hostname method to return a 200 status code and test the endpoint
    monkeypatch.setenv("DEVICE_VENDOR", "cisco")
    importlib.reload(main)

    client = TestClient(main.app)
    response = client.get(
        "/restconf/data/Cisco-IOS-XE-native:native/hostname",
        auth=("admin", "123")
    )

    assert response.status_code == 200


def test_get_hardware_cisco_endpoint(monkeypatch):
    # Stub the get_hardware method to return a 200 status code and test the endpoint
    monkeypatch.setenv("DEVICE_VENDOR", "cisco")
    importlib.reload(main)

    client = TestClient(main.app)
    response = client.get(
        "/restconf/data/Cisco-IOS-XE-device-hardware-oper:device-hardware-data/device-hardware/device-inventory",
        auth=("admin", "123")
    )

    assert response.status_code == 200


def test_get_system_information_juniper_endpoint(monkeypatch):
    # Stub the get_cpu method to return a specific value and test the endpoint
    monkeypatch.setenv("DEVICE_VENDOR", "juniper")
    importlib.reload(main)

    client = TestClient(main.app)
    monkeypatch.setattr(main.device, "get_cpu", lambda: 55)
    response = client.post(
        "/rpc/get-system-information",
        auth=("admin", "123")
    )

    assert response.status_code == 200


def test_get_route_engine_juniper_endpoint(monkeypatch):
    # Stub the get_used_memory method to return a specific value and test the endpoint
    monkeypatch.setenv("DEVICE_VENDOR", "juniper")
    importlib.reload(main)

    client = TestClient(main.app)
    monkeypatch.setattr(main.device, "get_used_memory", lambda: 4096)
    response = client.post(
        "/rpc/get-route-engine-information",
        auth=("admin", "123")
    )

    assert response.status_code == 200


def test_get_interfaces_juniper_endpoint(monkeypatch):
    # Stub the get_interfaces method to return a 200 status code and test the endpoint
    monkeypatch.setenv("DEVICE_VENDOR", "juniper")
    importlib.reload(main)

    client = TestClient(main.app)
    response = client.post(
        "/rpc/get-interface-information",
        auth=("admin", "123")
    )

    assert response.status_code == 200
