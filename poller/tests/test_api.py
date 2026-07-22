from poller import api
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, AsyncMock
import httpx
from sqlalchemy.exc import IntegrityError


def test_fastapi_lifespan_integration():
    # Test that the FastAPI lifespan correctly initializes and cleans up resources
    app = FastAPI(lifespan=api.lifespan)
    api.app_lifespan_data.clear()

    with TestClient(app):
        assert "http_client" in api.app_lifespan_data
        
        client = api.app_lifespan_data["http_client"]
        assert client.is_closed is False
        assert client.timeout.read == 10.0

    assert api.app_lifespan_data["http_client"].is_closed is True


@pytest.mark.asyncio
async def test_model_cisco_device_info_success(monkeypatch):
    # Mock the fetch_cisco_data_async to return specific data for hostname and device inventory
    async def mock_fetch_cisco_data(client, url, username, password):
        if "hostname" in url:
            return {"Cisco-IOS-XE-native:hostname": "Core-Switch-01"}
        elif "device-inventory" in url:
            return {
                "Cisco-IOS-XE-device-hardware-oper:device-inventory": [
                    {"hw-description": "  Cisco Catalyst 9300L  \n"}
                ]
            }
        return {}

    monkeypatch.setattr(api, "fetch_cisco_data_async", mock_fetch_cisco_data)

    mock_client = MagicMock(spec=httpx.AsyncClient)
    hostname, model = await api.model_cisco_device_info(
        ip="10.10.10.10",
        port=443,
        username="admin",
        password="secret_password",
        https=True,
        client=mock_client
    )

    assert hostname == "Core-Switch-01"
    assert model == "Cisco Catalyst 9300L"


@pytest.mark.asyncio
async def test_model_cisco_device_info_connection_error(monkeypatch):
    # Mock the fetch_cisco_data_async to raise a connection error
    async def mock_fetch_cisco_data_fail(*args, **kwargs):
        raise httpx.ConnectTimeout("Connection timed out")

    monkeypatch.setattr(api, "fetch_cisco_data_async", mock_fetch_cisco_data_fail)

    mock_client = MagicMock(spec=httpx.AsyncClient)
    
    with pytest.raises(ConnectionError) as exc_info:
        await api.model_cisco_device_info(
            ip="10.10.10.10",
            port=443,
            username="admin",
            password="password",
            https=True,
            client=mock_client
        )

    assert "Error during modeling device: 10.10.10.10:443" in str(exc_info.value)


@pytest.mark.asyncio
async def test_model_cisco_device_info_missing_keys_in_json(monkeypatch):
    # Mock the fetch_cisco_data_async to return JSON without expected keys
    async def mock_fetch_cisco_data_empty_json(*args, **kwargs):
        return {}

    monkeypatch.setattr(api, "fetch_cisco_data_async", mock_fetch_cisco_data_empty_json)

    mock_client = MagicMock(spec=httpx.AsyncClient)
    hostname, model = await api.model_cisco_device_info(
        ip="10.10.10.10",
        port=80,
        username="admin",
        password="password",
        https=False,
        client=mock_client
    )

    assert hostname == "Unknown"
    assert model == "Unknown"


@pytest.mark.asyncio
async def test_model_juniper_device_info_success(monkeypatch):
    # Mock the fetch_juniper_data_async to return specific data for system information
    async def mock_fetch_juniper_success(client, url, username, password):
        return {
            "system-information": [
                {
                    "host-name": [{"data": "juniper-edge-router"}],
                    "hardware-model": [{"data": "MX240"}]
                }
            ]
        }

    monkeypatch.setattr(api, "fetch_juniper_data_async", mock_fetch_juniper_success)

    mock_client = MagicMock(spec=httpx.AsyncClient)
    hostname, model = await api.model_juniper_device_info(
        ip="172.16.5.1",
        port=830,
        username="neteng",
        password="password123",
        https=True,
        client=mock_client
    )

    assert hostname == "juniper-edge-router"
    assert model == "MX240"


@pytest.mark.asyncio
async def test_model_juniper_device_info_network_error(monkeypatch):
    # Mock the fetch_juniper_data_async to raise a network error
    async def mock_fetch_juniper_fail(*args, **kwargs):
        raise httpx.ReadTimeout("Juniper dropped session")

    monkeypatch.setattr(api, "fetch_juniper_data_async", mock_fetch_juniper_fail)

    mock_client = MagicMock(spec=httpx.AsyncClient)
    
    with pytest.raises(ConnectionError) as exc_info:
        await api.model_juniper_device_info(
            ip="172.16.5.1",
            port=830,
            username="neteng",
            password="password123",
            https=True,
            client=mock_client
        )

    assert "Error during modeling device: 172.16.5.1:830" in str(exc_info.value)


@pytest.mark.asyncio
async def test_model_juniper_device_info_empty_or_malformed_json(monkeypatch):
    # Mock the fetch_juniper_data_async to return empty JSON, simulating a case where expected keys are missing
    async def mock_fetch_juniper_empty_json(*args, **kwargs):
        return {}

    monkeypatch.setattr(api, "fetch_juniper_data_async", mock_fetch_juniper_empty_json)

    mock_client = MagicMock(spec=httpx.AsyncClient)
    hostname, model = await api.model_juniper_device_info(
        ip="172.16.5.1",
        port=80,
        username="neteng",
        password="password123",
        https=False,
        client=mock_client
    )

    assert hostname == "Unknown"
    assert model == "Unknown"


def test_health_endpoint():
    # Test that the /health endpoint returns status OK
    client = TestClient(api.app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "OK"}


@pytest.fixture
def client_factory(monkeypatch):
    # Mock the database session and HTTP client for testing the API endpoints
    api.app_lifespan_data["http_client"] = MagicMock()

    mock_session_instance = MagicMock()
    
    mock_session_instance.__enter__.return_value = mock_session_instance
    
    mock_tx_context = MagicMock()
    mock_session_instance.begin.return_value = mock_tx_context
    mock_tx_context.__enter__.return_value = MagicMock()

    mock_session_cls = MagicMock(return_value=mock_session_instance)
    monkeypatch.setattr(api, "Session", mock_session_cls)

    class DummyDevice:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)

    monkeypatch.setattr(api, "Device", DummyDevice)

    return mock_session_instance, TestClient(api.app)


def test_add_device_success_cisco(client_factory, monkeypatch):
    # Test adding a Cisco device successfully, mocking the model_cisco_device_info to return specific hostname and model
    mock_db, client = client_factory

    mock_model = AsyncMock(return_value=("Cisco-Core", "Catalyst 9300"))
    monkeypatch.setattr(api, "model_cisco_device_info", mock_model)
    monkeypatch.setattr(
        api,
        "discover_and_sync_interfaces",
        AsyncMock(return_value=[]),
    )

    payload = {
        "ip": "10.0.0.1",
        "port": 443,
        "vendor": "cisco",
        "username": "admin",
        "password": "password123",
        "https": True
    }

    response = client.post("/api/device", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert data["hostname"] == "Cisco-Core"
    assert data["model"] == "Catalyst 9300"
    
    mock_db.add.assert_called_once()
    mock_db.refresh.assert_called_once()


def test_add_device_unsupported_vendor(client_factory):
    # Test that adding a device with an unsupported vendor returns a 400 error
    _, client = client_factory

    payload = {
        "ip": "10.0.0.2",
        "port": 22,
        "vendor": "HP-ProCurve",
        "username": "admin",
        "password": "password",
        "https": False
    }

    response = client.post("/api/device", json=payload)

    assert response.status_code == 400
    assert "Unsupported vendor" in response.json()["detail"]


def test_add_device_network_connection_error(client_factory, monkeypatch):
    # Test that if the model_cisco_device_info raises a ConnectionError, the API returns a 502 Bad Gateway error
    _, client = client_factory

    async def mock_model_fail(*args, **kwargs):
        raise ConnectionError("Device unreachable on port 443")
        
    monkeypatch.setattr(api, "model_cisco_device_info", mock_model_fail)

    payload = {
        "ip": "10.0.0.3",
        "port": 443,
        "vendor": "cisco",
        "username": "admin",
        "password": "pass",
        "https": True
    }

    response = client.post("/api/device", json=payload)

    assert response.status_code == 502
    assert "Device unreachable" in response.json()["detail"]


def test_add_device_duplicate_integrity_error(client_factory, monkeypatch):
    # Test that if the database raises an IntegrityError due to a unique constraint violation, the API returns a 409 Conflict error
    mock_db, client = client_factory

    monkeypatch.setattr(api, "model_juniper_device_info", AsyncMock(return_value=("Jun-SRX", "SRX300")))

    mock_db.add.side_effect = IntegrityError("Unique constraint failed", params=[], orig=None)

    payload = {
        "ip": "10.0.0.1",
        "port": 830,
        "vendor": "juniper",
        "username": "neteng",
        "password": "password",
        "https": True
    }

    response = client.post("/api/device", json=payload)

    assert response.status_code == 409
    assert "already exists in database" in response.json()["detail"]


def test_add_device_generic_database_error(client_factory, monkeypatch):
    # Test that if the database raises a generic exception during add, the API returns a 500 Internal Server Error
    mock_db, client = client_factory

    monkeypatch.setattr(api, "model_juniper_device_info", AsyncMock(return_value=("Jun-SRX", "SRX300")))

    mock_db.add.side_effect = Exception("OperationalError: disk I/O error")

    payload = {
        "ip": "10.0.0.5",
        "port": 830,
        "vendor": "juniper",
        "username": "neteng",
        "password": "password",
        "https": True
    }

    response = client.post("/api/device", json=payload)

    assert response.status_code == 500
    assert "Internal database error occurred." in response.json()["detail"]


@pytest.fixture
def delete_client_factory(monkeypatch):
    # Mock the database session and HTTP client for testing the delete device endpoint
    mock_session_instance = MagicMock()
    mock_session_instance.__enter__.return_value = mock_session_instance

    mock_session_cls = MagicMock(return_value=mock_session_instance)
    monkeypatch.setattr(api, "Session", mock_session_cls)

    return mock_session_instance, TestClient(api.app)


def test_delete_device_success(delete_client_factory, monkeypatch):
    # Test that deleting an existing device returns a 200 status and calls the appropriate database methods
    mock_db, client = delete_client_factory

    mock_device = MagicMock()
    
    mock_db.query.return_value.filter.return_value.first.return_value = mock_device

    response = client.delete("/api/device/42")

    assert response.status_code == 200
    assert response.json() == {
        "status": "deleted",
        "message": "Successfully deleted device"
    }

    mock_db.delete.assert_called_once_with(mock_device)
    mock_db.commit.assert_called_once()


def test_delete_device_not_found(delete_client_factory):
    # Test that trying to delete a non-existent device returns a 404 error and does not call delete or commit on the database
    mock_db, client = delete_client_factory


    mock_db.query.return_value.filter.return_value.first.return_value = None

    response = client.delete("/api/device/999")

    assert response.status_code == 404
    assert "Not found device with ID: 999." in response.json()["detail"]
    
    mock_db.delete.assert_not_called()
    mock_db.commit.assert_not_called()


def test_delete_device_database_crash(delete_client_factory):
    # Test that if the database raises an exception during commit, the API returns a 500 Internal Server Error
    mock_db, client = delete_client_factory

    mock_device = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = mock_device
    
    mock_db.commit.side_effect = Exception("OperationalError: Connection lost")

    response = client.delete("/api/device/42")

    assert response.status_code == 500
    assert "Internal database error occurred." in response.json()["detail"]


@pytest.fixture
def rediscover_client_factory(monkeypatch):
    # Mock the database session and HTTP client for testing the rediscover device endpoint
    api.app_lifespan_data["http_client"] = MagicMock()

    mock_session_instance = MagicMock()
    mock_session_instance.__enter__.return_value = mock_session_instance
    
    mock_session_cls = MagicMock(return_value=mock_session_instance)
    monkeypatch.setattr(api, "Session", mock_session_cls)

    class DummyDevice:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)

    return mock_session_instance, TestClient(api.app), DummyDevice


def test_rediscover_device_success_cisco(rediscover_client_factory, monkeypatch):
    # Test that rediscovering an existing Cisco device successfully updates its hostname and model, and commits the changes to the database
    mock_db, client, DummyDevice = rediscover_client_factory

    existing_device = DummyDevice(
        id=10,
        vendor="Cisco",
        ip="10.255.0.1",
        port=443,
        username="neteng",
        password="old_password",
        https=True,
        hostname="Old-Cisco-Name",
        model="Old-Model"
    )
    mock_db.query.return_value.filter.return_value.first.return_value = existing_device

    mock_network_call = AsyncMock(return_value=("New-Cisco-Core", "Catalyst-9500"))
    monkeypatch.setattr(api, "model_cisco_device_info", mock_network_call)
    monkeypatch.setattr(
        api,
        "discover_and_sync_interfaces",
        AsyncMock(return_value=[]),
    )

    response = client.post("/api/rediscover/10")

    assert response.status_code == 200
    data = response.json()
    assert data["hostname"] == "New-Cisco-Core"
    assert data["model"] == "Catalyst-9500"
    
    mock_db.commit.assert_called_once()
    mock_db.refresh.assert_called_once_with(existing_device)


def test_rediscover_device_not_found(rediscover_client_factory):
    # Test that trying to rediscover a non-existent device returns a 404 error and does not call commit on the database
    mock_db, client, _ = rediscover_client_factory

    mock_db.query.return_value.filter.return_value.first.return_value = None

    response = client.post("/api/rediscover/999")

    assert response.status_code == 404
    assert "Not found device with ID: 999." in response.json()["detail"]
    
    mock_db.commit.assert_not_called()


def test_rediscover_device_connection_error(rediscover_client_factory, monkeypatch):
    # Test that if the modeling function raises a ConnectionError, the API returns a 502 Bad Gateway error and does not call commit on the database
    mock_db, client, DummyDevice = rediscover_client_factory

    existing_device = DummyDevice(
        id=20, vendor="Juniper", ip="10.255.0.2", port=830,
        username="admin", password="p", https=True, hostname="Jun-01", model="SRX"
    )
    mock_db.query.return_value.filter.return_value.first.return_value = existing_device

    async def mock_juniper_fail(*args, **kwargs):
        raise ConnectionError("RPC connection timed out")
        
    monkeypatch.setattr(api, "model_juniper_device_info", mock_juniper_fail)

    response = client.post("/api/rediscover/20")

    assert response.status_code == 502
    assert "Device unreachable" in response.json()["detail"]
    mock_db.commit.assert_not_called()


def test_rediscover_device_database_commit_crash(rediscover_client_factory, monkeypatch):
    # Test that if the database raises an exception during commit, the API returns a 500 Internal Server Error
    mock_db, client, DummyDevice = rediscover_client_factory

    existing_device = DummyDevice(
        id=30, vendor="Cisco", ip="10.255.0.3", port=443,
        username="admin", password="p", https=True, hostname="Cisco", model="ISR"
    )
    mock_db.query.return_value.filter.return_value.first.return_value = existing_device

    monkeypatch.setattr(api, "model_cisco_device_info", AsyncMock(return_value=("New-Name", "New-Model")))
    monkeypatch.setattr(
        api,
        "discover_and_sync_interfaces",
        AsyncMock(return_value=[]),
    )
    mock_db.commit.side_effect = Exception("Deadlock or Connection Lost")

    response = client.post("/api/rediscover/30")

    assert response.status_code == 500
    assert "Internal database error occurred." in response.json()["detail"]


def test_rediscover_device_unsupported_vendor(rediscover_client_factory):
    # Test that if the device has an unsupported vendor, the API returns a 400 error and does not call commit on the database
    mock_db, client, DummyDevice = rediscover_client_factory

    corrupted_device = DummyDevice(
        id=40,
        vendor="Huawei",
        ip="10.255.0.4",
        port=22,
        username="admin",
        password="password123",
        https=False,
        hostname="Some-Device",
        model="Some-Model"
    )
    mock_db.query.return_value.filter.return_value.first.return_value = corrupted_device

    response = client.post("/api/rediscover/40")

    assert response.status_code == 400
    assert "Unsupported vendor: Huawei" in response.json()["detail"]

    mock_db.commit.assert_not_called()


@pytest.fixture
def read_client_factory(monkeypatch):
    # Fixture preparing a TestClient and a base mock of the DB session for GET requests
    """Fixture przygotowujący TestClient oraz bazowy mock sesji DB dla zapytań GET."""
    mock_session_instance = MagicMock()
    mock_session_instance.__enter__.return_value = mock_session_instance

    mock_session_cls = MagicMock(return_value=mock_session_instance)
    monkeypatch.setattr(api, "Session", mock_session_cls)

    class DummyDevice:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)

    return mock_session_instance, TestClient(api.app), DummyDevice


def test_get_device_by_id_success(read_client_factory):
    # Test that getting an existing device by ID returns a 200 status and the correct device data
    mock_db, client, DummyDevice = read_client_factory

    existing_device = DummyDevice(
        id=5,
        ip="192.168.1.5",
        port=443,
        vendor="cisco",
        hostname="Cisco-Switch-05",
        username="admin",
        password="password",
        model="Catalyst-2960",
        https=True
    )
    mock_db.query.return_value.filter.return_value.first.return_value = existing_device

    response = client.get("/api/device/5")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 5
    assert data["hostname"] == "Cisco-Switch-05"


def test_get_device_by_id_not_found(read_client_factory):
    # Test that trying to get a non-existent device by ID returns a 404 error
    mock_db, client, _ = read_client_factory

    mock_db.query.return_value.filter.return_value.first.return_value = None

    response = client.get("/api/device/999")

    assert response.status_code == 404
    assert "Not found device with ID: 999" in response.json()["detail"]


def test_get_devices_paginated(read_client_factory, monkeypatch):
    # Test that getting devices with pagination returns a 200 status and the correct paginated data structure
    mock_db, client, _ = read_client_factory

    mock_paginated_data = {
        "items": [
            {"id": 1, "ip": "10.0.0.1", "port": 443, "vendor": "cisco", "hostname": "R1", "model": "ISR", "https": True, "username": "admin", "password": "pass"},
            {"id": 2, "ip": "10.0.0.2", "port": 830, "vendor": "juniper", "hostname": "R2", "model": "SRX", "https": True, "username": "admin", "password": "pass"}
        ],
        "total": 2,
        "page": 1,
        "size": 50,
        "pages": 1
    }

    monkeypatch.setattr(api, "paginate", lambda db, query: mock_paginated_data)

    response = client.get("/api/devices")

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2
    assert data["items"][0]["hostname"] == "R1"
    assert data["items"][1]["hostname"] == "R2"

    mock_db.query.assert_called_once_with(api.Device)
    mock_db.query.return_value.order_by.assert_called_once()


@pytest.fixture
def patch_client_factory(monkeypatch):
    # Fixture preparing a TestClient and a mock of the DB session for testing PATCH requests to update devices
    mock_session_instance = MagicMock()
    mock_session_instance.__enter__.return_value = mock_session_instance

    mock_tx_context = MagicMock()
    mock_session_instance.begin.return_value = mock_tx_context
    mock_tx_context.__enter__.return_value = MagicMock()

    mock_session_cls = MagicMock(return_value=mock_session_instance)
    monkeypatch.setattr(api, "Session", mock_session_cls)

    class DummyDevice:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)

    return mock_session_instance, TestClient(api.app), DummyDevice


def test_update_device_success_partial(patch_client_factory):
    # Test that partially updating an existing device with valid data returns a 200 status and updates the correct fields while leaving others unchanged
    mock_db, client, DummyDevice = patch_client_factory

    existing_device = DummyDevice(
        id=7,
        ip="10.0.0.7",
        port=22,
        vendor="cisco",
        model="Catalyst-2960",
        username="admin",
        password="secure123",
        hostname="Old-Cisco",
        https=False
    )
    mock_db.query.return_value.filter.return_value.first.return_value = existing_device

    payload = {
        "username": "newUsername",
        "password": "newPassword",
        "https": True,
        "port": 443
    }

    response = client.patch("/api/device/7", json=payload)

    assert response.status_code == 200
    data = response.json()
    
    assert data["port"] == 443
    assert data["password"] == "newPassword"
    assert data["https"] is True
    assert data["username"] == "newUsername"

    assert data["ip"] == "10.0.0.7"
    assert data["vendor"] == "cisco"
    assert data["model"] == "Catalyst-2960"

    mock_db.refresh.assert_called_once_with(existing_device)


def test_update_device_not_found(patch_client_factory):
    # Test that trying to update a non-existent device returns a 404 error and does not call refresh on the database
    mock_db, client, _ = patch_client_factory

    mock_db.query.return_value.filter.return_value.first.return_value = None

    payload = {
        "hostname": "Ghost-Device"
    }

    response = client.patch("/api/device/999", json=payload)

    assert response.status_code == 404
    assert response.json()["detail"] == "Device not found"
    
    mock_db.refresh.assert_not_called()


def test_get_device_interfaces_success(read_client_factory):
    mock_db, client, DummyDevice = read_client_factory

    existing_device = DummyDevice(id=5, hostname="Cisco-Switch-05")
    interface = DummyDevice(
        id=1,
        device_id=5,
        name="Gi0/0",
        if_index=1,
        mac="00:11:22:33:44:55",
        speed_bps=1_000_000_000,
        admin_status="up",
        oper_status="up",
        discovered_at="2026-01-01T00:00:00Z",
    )

    mock_db.query.return_value.filter.return_value.first.return_value = existing_device
    mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [
        interface
    ]

    response = client.get("/api/device/5/interfaces")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Gi0/0"
    assert data[0]["if_index"] == 1


def test_get_device_interfaces_device_not_found(read_client_factory):
    mock_db, client, _ = read_client_factory

    mock_db.query.return_value.filter.return_value.first.return_value = None

    response = client.get("/api/device/999/interfaces")

    assert response.status_code == 404
    assert "Not found device with ID: 999." in response.json()["detail"]