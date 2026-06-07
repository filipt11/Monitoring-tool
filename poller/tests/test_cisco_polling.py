from poller import cisco_polling
import pytest
from unittest.mock import AsyncMock, MagicMock, ANY
import httpx


def test_parse_cpu():
    # Valid response with expected key
    sample_response = {
        "Cisco-IOS-XE-process-cpu-oper:five-seconds": 20
    }
    assert cisco_polling.parse_cpu(sample_response) == 20


def test_parse_cpu_missing_key():
    # Response missing the expected key should raise KeyError
    sample_response = {
        "Cisco-IOS-XE-wrong-key": 15
    }
    with pytest.raises(KeyError):
        cisco_polling.parse_cpu(sample_response)


def test_parse_memory_success():
    # Valid response with 'Processor' entry
    sample_response = {
        "Cisco-IOS-XE-memory-oper:memory-statistics": {
            "memory-statistic": [
                {
                    "name": "System",
                    "used-memory": "1000000",
                    "total-memory": "2000000"
                },
                {
                    "name": "Processor",
                    "used-memory": "5000000",
                    "total-memory": "16000000"
                }
            ]
        }
    }
    
    total, used = cisco_polling.parse_memory(sample_response)
    
    assert total == 16000000
    assert used == 5000000


def test_parse_memory_missing_processor():
    # Response missing 'Processor' entry should raise ValueError
    invalid_response = {
        "Cisco-IOS-XE-memory-oper:memory-statistics": {
            "memory-statistic": [
                {
                    "name": "Driver-Pool",
                    "used-memory": "500",
                    "total-memory": "1000"
                }
            ]
        }
    }
    
    with pytest.raises(ValueError) as exc_info:
        cisco_polling.parse_memory(invalid_response)

    assert "Could not find 'Processor' entry" in str(exc_info.value)


def test_parse_interfaces_success():
    # Valid response with one active interface
    sample_response = {
        "ietf-interfaces:interfaces-state": {
            "interface": [
                {
                    "name": "GigabitEthernet1",
                    "admin-status": "up",
                    "oper-status": "up",
                    "if-index": "101",
                    "speed": "1000000000",
                    "phys-address": "00:11:22:33:44:55",
                    "statistics": {
                        "in-octets": "123456",
                        "out-octets": "789012"
                    }
                },
                {
                    "name": "GigabitEthernet2",
                    "admin-status": "down",
                    "oper-status": "down",
                    "if-index": "102",
                    "speed": "1000000000",
                    "statistics": {
                        "in-octets": "0",
                        "out-octets": "0"
                    }
                }
            ]
        }
    }

    result = cisco_polling.parse_interfaces(sample_response)

    assert len(result) == 1
    
    parsed_if = result[0]
    assert parsed_if["name"] == "GigabitEthernet1"
    assert parsed_if["if_index"] == 101
    assert parsed_if["in_octets"] == 123456
    assert parsed_if["out_octets"] == 789012
    assert parsed_if["speed"] == 1000000000
    assert parsed_if["admin_status"] == "up"
    assert parsed_if["oper_status"] == "up"
    assert parsed_if["mac"] == "00:11:22:33:44:55"


def test_parse_interfaces_no_active_interfaces():
    # Response with no active interfaces should raise ValueError
    invalid_response = {
        "ietf-interfaces:interfaces-state": {
            "interface": [
                {
                    "name": "GigabitEthernet2",
                    "admin-status": "down",
                    "oper-status": "down",
                    "if-index": "102",
                    "speed": "1000000000",
                    "statistics": {
                        "in-octets": "0",
                        "out-octets": "0"
                    }
                }
            ]
        }
    }

    with pytest.raises(ValueError) as exc_info:
        cisco_polling.parse_interfaces(invalid_response)

    assert "No active interfaces with statistics found" in str(exc_info.value)


@pytest.mark.asyncio
async def test_fetch_cisco_data_async_success():
    # Mock the httpx.AsyncClient.get method to return a successful response
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.json.return_value = {"cisco-data": "value"}
    
    mock_client = MagicMock(spec=httpx.AsyncClient)
    mock_client.get = AsyncMock(return_value=mock_response)

    result = await cisco_polling.fetch_cisco_data_async(
        client=mock_client,
        url="https://10.0.0.1/restconf/data",
        username="admin",
        password="secret_password"
    )

    assert result == {"cisco-data": "value"}
  
    mock_client.get.assert_called_once_with(
        "https://10.0.0.1/restconf/data",
        auth=ANY, 
        headers={
            "Accept": "application/yang-data+json",
            "Content-Type": "application/yang-data+json",
        },
        timeout=10
    )


@pytest.mark.asyncio
async def test_fetch_cisco_data_async_http_error():
    # Mock the httpx.AsyncClient.get method to raise an HTTP error
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
        message="Internal Server Error",
        request=MagicMock(),
        response=mock_response
    )
    
    mock_client = MagicMock(spec=httpx.AsyncClient)
    mock_client.get = AsyncMock(return_value=mock_response)

    with pytest.raises(httpx.HTTPStatusError):
        await cisco_polling.fetch_cisco_data_async(
            client=mock_client,
            url="https://10.0.0.1/restconf/data",
            username="admin",
            password="secret_password"
        )


@pytest.fixture
def mock_device():
    # Create a mock device object with necessary attributes for testing
    device = MagicMock()
    device.https = True
    device.ip = "10.10.10.1"
    device.port = 443
    device.username = "admin"
    device.password = "cisco_pass"
    device.hostname = "Core-Switch-01"
    return device


@pytest.mark.asyncio
async def test_poll_cisco_device_async_success(monkeypatch, mock_device):
    # Mock the fetch_cisco_data_async function to return predefined data
    async def mock_fetch(client, url, username, password):
        if "cpu" in url:
            return {"mock_raw": "cpu_data"}
        if "memory" in url:
            return {"mock_raw": "memory_data"}
        if "interfaces" in url:
            return {"mock_raw": "interface_data"}
        return {}

    monkeypatch.setattr(cisco_polling, "fetch_cisco_data_async", mock_fetch)

    monkeypatch.setattr(cisco_polling, "parse_cpu", lambda raw: 15)
    monkeypatch.setattr(cisco_polling, "parse_memory", lambda raw: (1000, 400))
    monkeypatch.setattr(cisco_polling, "parse_interfaces", lambda raw: [{"name": "Gi0/1"}])

    mock_client = MagicMock(spec=httpx.AsyncClient)
    result = await cisco_polling.poll_cisco_device_async(mock_device, mock_client)

    assert result["status"] == "up"
    assert result["cpu"] == 15
    assert result["total_memory"] == 1000
    assert result["used_memory"] == 400
    assert result["memory_pct"] == 40.0
    assert len(result["interfaces"]) == 1
    assert result["interfaces"][0]["name"] == "Gi0/1"


@pytest.mark.asyncio
async def test_poll_cisco_device_async_network_failure(monkeypatch, mock_device):
    # Mock the fetch_cisco_data_async function to raise a connection error
    async def mock_fetch_fail(client, url, username, password):
        raise httpx.ConnectError("Connection timed out")

    monkeypatch.setattr(cisco_polling, "fetch_cisco_data_async", mock_fetch_fail)

    mock_client = MagicMock(spec=httpx.AsyncClient)
    result = await cisco_polling.poll_cisco_device_async(mock_device, mock_client)

    assert result["status"] == "down"
    assert result["cpu"] is None
    assert result["total_memory"] is None
    assert result["used_memory"] is None
    assert result["memory_pct"] is None
    assert result["interfaces"] == []


async def _mock_fetch_all_success(client, url, username, password):
    # Return different mock data based on URL to simulate successful fetches for CPU, Memory, and Interfaces
    return {"mock_raw": "some_data"}


@pytest.mark.asyncio
async def test_poll_cisco_device_async_cpu_parsing_error(monkeypatch, mock_device):
    # Mock fetch to return valid data for all endpoints
    monkeypatch.setattr(cisco_polling, "fetch_cisco_data_async", _mock_fetch_all_success)

    def mock_parse_cpu_fail(raw):
        raise ValueError("Invalid CPU JSON structure from device")
        
    monkeypatch.setattr(cisco_polling, "parse_cpu", mock_parse_cpu_fail)
    
    monkeypatch.setattr(cisco_polling, "parse_memory", lambda raw: (1000, 300))
    monkeypatch.setattr(cisco_polling, "parse_interfaces", lambda raw: [{"name": "Gi0/1"}])

    mock_client = MagicMock(spec=httpx.AsyncClient)
    result = await cisco_polling.poll_cisco_device_async(mock_device, mock_client)

    assert result["status"] == "up"
    assert result["cpu"] is None
    assert result["total_memory"] == 1000
    assert result["used_memory"] == 300
    assert result["memory_pct"] == 30.0
    assert len(result["interfaces"]) == 1


@pytest.mark.asyncio
async def test_poll_cisco_device_async_memory_parsing_error(monkeypatch, mock_device):
    # Mock fetch to return valid data for all endpoints
    monkeypatch.setattr(cisco_polling, "fetch_cisco_data_async", _mock_fetch_all_success)

    monkeypatch.setattr(cisco_polling, "parse_cpu", lambda raw: 25)
    monkeypatch.setattr(cisco_polling, "parse_interfaces", lambda raw: [{"name": "Gi0/1"}])
    
    def mock_parse_memory_fail(raw):
        raise KeyError("Cisco-IOS-XE-memory-oper missing")
        
    monkeypatch.setattr(cisco_polling, "parse_memory", mock_parse_memory_fail)

    mock_client = MagicMock(spec=httpx.AsyncClient)
    result = await cisco_polling.poll_cisco_device_async(mock_device, mock_client)

    assert result["status"] == "up"
    assert result["cpu"] == 25
    assert result["total_memory"] is None
    assert result["used_memory"] is None
    assert result["memory_pct"] is None
    assert len(result["interfaces"]) == 1


@pytest.mark.asyncio
async def test_poll_cisco_device_async_interfaces_parsing_error(monkeypatch, mock_device):
    # Mock fetch to return valid data for all endpoints
    monkeypatch.setattr(cisco_polling, "fetch_cisco_data_async", _mock_fetch_all_success)

    monkeypatch.setattr(cisco_polling, "parse_cpu", lambda raw: 5)
    monkeypatch.setattr(cisco_polling, "parse_memory", lambda raw: (2000, 1000))
    
    def mock_parse_interfaces_fail(raw):
        raise Exception("Fatal interface structure corruption")
        
    monkeypatch.setattr(cisco_polling, "parse_interfaces", mock_parse_interfaces_fail)

    mock_client = MagicMock(spec=httpx.AsyncClient)
    result = await cisco_polling.poll_cisco_device_async(mock_device, mock_client)

    assert result["status"] == "up"
    assert result["cpu"] == 5
    assert result["total_memory"] == 2000
    assert result["used_memory"] == 1000
    assert result["memory_pct"] == 50.0
    assert result["interfaces"] == []