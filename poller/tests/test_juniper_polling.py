from poller import juniper_polling
import pytest
from unittest.mock import AsyncMock, MagicMock, ANY
import httpx

def test_parse_cpu_juniper_success():
    # Check if CPU usage is correctly calculated as 100 - idle
    sample_response = {
        "route-engine-information": [
            {
                "route-engine": [
                    {
                        "cpu-idle": [
                            {
                                "data": "88"
                            }
                        ]
                    }
                ]
            }
        ]
    }

    cpu_usage = juniper_polling.parse_cpu(sample_response)

    # 100 - 88 = 12% CPU usage
    assert cpu_usage == 12
    assert isinstance(cpu_usage, int)


def test_parse_cpu_juniper_missing_key():
    # Check that missing keys raise KeyError
    invalid_response = {
        "route-engine-information": [
            {
                "route-engine": [
                    {
                        "memory-buffer-utilization": [{"data": "45"}]
                    }
                ]
            }
        ]
    }

    with pytest.raises(KeyError):
        juniper_polling.parse_cpu(invalid_response)


def test_parse_memory_juniper_success():
    # Check if memory parsing correctly extracts total, used, and percentage values
    sample_response = {
        "route-engine-information": [
            {
                "route-engine": [
                    {
                        "memory-installed-size": [{"data": "16384 MB"}],
                        "memory-buffer-utilization": [{"data": "50.0"}]
                    }
                ]
            }
        ]
    }

    total, used, pct = juniper_polling.parse_memory(sample_response)

    assert total == 17179869184
    assert pct == 50.0
    assert used == 8589934592
    
    assert isinstance(total, int)
    assert isinstance(used, int)
    assert isinstance(pct, float)


def test_parse_memory_juniper_regex_fallback():
    # Total memory string is in an unexpected format that regex cannot parse
    invalid_response = {
        "route-engine-information": [
            {
                "route-engine": [
                    {
                        "memory-installed-size": [{"data": "Unknown Status"}],
                        "memory-buffer-utilization": [{"data": "25.5"}]
                    }
                ]
            }
        ]
    }

    total, used, pct = juniper_polling.parse_memory(invalid_response)

    assert total == 0
    assert pct == 25.5
    assert used == 0


def test_parse_memory_juniper_missing_key():
    # Check that missing keys raise KeyError
    invalid_response = {
        "route-engine-information": [
            {
                "route-engine": [
                    {
                        "memory": [{"memory": "1684 MB"}]
                    }
                ]
            }
        ]
    }

    with pytest.raises(KeyError):
        juniper_polling.parse_memory(invalid_response)


def test_parse_interfaces_juniper_success():
    # Check that only active interfaces are parsed and statistics are extracted correctly
    sample_response = {
        "interface-information": [
            {
                "physical-interface": [
                    {
                        "name": [{"data": "ge-0/0/0"}],
                        "admin-status": [{"data": "up"}],
                        "oper-status": [{"data": "up"}],
                        "local-index": [{"data": "148"}],
                        "speed": [{"data": "1000Mbps"}],
                        "current-physical-address": [{"data": "00:11:22:33:44:55"}],
                        "logical-interface": [
                            {
                                "traffic-statistics": [
                                    {
                                        "input-bytes": [{"data": "5000"}],
                                        "output-bytes": [{"data": "6000"}]
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        "name": [{"data": "ge-0/0/1"}],
                        "admin-status": [{"data": "down"}],
                        "oper-status": [{"data": "down"}]
                    }
                ]
            }
        ]
    }

    result = juniper_polling.parse_interfaces(sample_response)

    assert len(result) == 1
    if_data = result[0]
    assert if_data["name"] == "ge-0/0/0"
    assert if_data["if_index"] == 148
    assert if_data["speed"] == 1000000000
    assert if_data["in_octets"] == 5000
    assert if_data["out_octets"] == 6000
    assert if_data["admin_status"] == "up"
    assert if_data["oper_status"] == "up"
    assert if_data["mac"] == "00:11:22:33:44:55"


def test_parse_interfaces_juniper_no_active_interfaces():
    # Check that ValueError is raised if no active interfaces with statistics are found
    invalid_response = {
        "interface-information": [
            {
                "physical-interface": [
                    {
                        "name": [{"data": "ge-0/0/2"}],
                        "admin-status": [{"data": "down"}]
                    }
                ]
            }
        ]
    }

    with pytest.raises(ValueError) as exc_info:
        juniper_polling.parse_interfaces(invalid_response)

    assert "No active interfaces with statistics found" in str(exc_info.value)


def test_parse_interfaces_juniper_fallback_and_defaults():
    # Check that missing keys and malformed values are handled gracefully with defaults
    malformed_response = {
        "interface-information": [
            {
                "physical-interface": [
                    {
                        "admin-status": [{"data": "up"}],
                        "speed": [{"data": "Auto-Negotiate"}],
                    }
                ]
            }
        ]
    }

    result = juniper_polling.parse_interfaces(malformed_response)

    assert len(result) == 1
    if_data = result[0]
    
    assert if_data["name"] == "unknown"
    assert if_data["if_index"] == 0
    assert if_data["speed"] == 0 
    assert if_data["in_octets"] == 0 
    assert if_data["out_octets"] == 0
    assert if_data["admin_status"] == "up"
    assert if_data["oper_status"] == "down"
    assert if_data["mac"] == "unknown"


@pytest.mark.asyncio
async def test_fetch_juniper_data_async_success():
    # Check that fetch_juniper_data_async correctly makes an HTTP POST request and returns JSON data
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.json.return_value = {"route-engine-information": []}
    

    mock_client = MagicMock(spec=httpx.AsyncClient)
    mock_client.post = AsyncMock(return_value=mock_response)

    result = await juniper_polling.fetch_juniper_data_async(
        client=mock_client,
        url="https://10.99.99.1/rpc/get-route-engine-information",
        username="neteng",
        password="juniper_password"
    )


    assert result == {"route-engine-information": []}
    mock_client.post.assert_called_once_with(
        "https://10.99.99.1/rpc/get-route-engine-information",
        auth=ANY,
        headers={"Accept": "application/json"},
        data={},
        timeout=10
    )


@pytest.mark.asyncio
async def test_fetch_juniper_data_async_http_error():
    # Check that HTTP errors are raised properly when the response status code indicates an error (e.g., 401 Unauthorized)
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
        message="401 Unauthorized",
        request=MagicMock(),
        response=mock_response
    )
    
    mock_client = MagicMock(spec=httpx.AsyncClient)
    mock_client.post = AsyncMock(return_value=mock_response)

    with pytest.raises(httpx.HTTPStatusError):
        await juniper_polling.fetch_juniper_data_async(
            client=mock_client,
            url="https://10.99.99.1/rpc/get-route-engine-information",
            username="wrong_user",
            password="wrong_password"
        )


@pytest.fixture
def mock_device():
    # Create a mock Device object with necessary attributes for testing
    device = MagicMock()
    device.https = True
    device.ip = "10.20.30.40"
    device.port = 443
    device.username = "neteng"
    device.password = "juniper_pass"
    device.hostname = "Juniper-Core-01"
    return device

async def _mock_juniper_fetch_success(client, url, username, password):
    return {"mock_raw": "juniper_data"}


@pytest.mark.asyncio
async def test_poll_juniper_device_async_success(monkeypatch, mock_device):
    # Simulate successful data fetch and parsing for CPU, Memory, and Interfaces
    monkeypatch.setattr(juniper_polling, "fetch_juniper_data_async", _mock_juniper_fetch_success)

    monkeypatch.setattr(juniper_polling, "parse_cpu", lambda raw: 12)
    monkeypatch.setattr(juniper_polling, "parse_memory", lambda raw: (16000, 4000, 25.0))
    monkeypatch.setattr(juniper_polling, "parse_interfaces", lambda raw: [{"name": "ge-0/0/0"}])

    mock_client = MagicMock(spec=httpx.AsyncClient)
    result = await juniper_polling.poll_juniper_device_async(mock_device, mock_client)

    assert result["status"] == "up"
    assert result["cpu"] == 12
    assert result["total_memory"] == 16000
    assert result["used_memory"] == 4000
    assert result["memory_pct"] == 25.0
    assert len(result["interfaces"]) == 1
    assert result["interfaces"][0]["name"] == "ge-0/0/0"


@pytest.mark.asyncio
async def test_poll_juniper_device_async_network_failure(monkeypatch, mock_device):
    # Simulate a network failure during data fetching, which should result in a "down" status and no metrics
    async def mock_fetch_fail(client, url, username, password):
        raise httpx.ConnectError("Juniper RPC dead")

    monkeypatch.setattr(juniper_polling, "fetch_juniper_data_async", mock_fetch_fail)

    mock_client = MagicMock(spec=httpx.AsyncClient)
    result = await juniper_polling.poll_juniper_device_async(mock_device, mock_client)

    assert result["status"] == "down"
    assert result["cpu"] is None
    assert result["total_memory"] is None
    assert result["used_memory"] is None
    assert result["memory_pct"] is None
    assert result["interfaces"] == []


@pytest.mark.asyncio
async def test_poll_juniper_device_async_route_engine_error(monkeypatch, mock_device):
    # Simulate a parsing error in the route-engine data, which should be logged but not crash the entire polling process
    monkeypatch.setattr(juniper_polling, "fetch_juniper_data_async", _mock_juniper_fetch_success)

    def mock_parse_cpu_crash(raw):
        raise KeyError("Missing route-engine key")

    monkeypatch.setattr(juniper_polling, "parse_cpu", mock_parse_cpu_crash)
    monkeypatch.setattr(juniper_polling, "parse_memory", lambda raw: (16000, 4000, 25.0))
    monkeypatch.setattr(juniper_polling, "parse_interfaces", lambda raw: [{"name": "ge-0/0/0"}])

    mock_client = MagicMock(spec=httpx.AsyncClient)
    result = await juniper_polling.poll_juniper_device_async(mock_device, mock_client)

    assert result["status"] == "up"
    assert result["cpu"] is None
    assert result["total_memory"] is None
    assert result["used_memory"] is None
    assert result["memory_pct"] is None
    assert len(result["interfaces"]) == 1


@pytest.mark.asyncio
async def test_poll_juniper_device_async_interfaces_parsing_crash(monkeypatch, mock_device):
    # Simulate a parsing error in the interfaces data, which should be logged but not crash the entire polling process
    monkeypatch.setattr(juniper_polling, "fetch_juniper_data_async", _mock_juniper_fetch_success)

    monkeypatch.setattr(juniper_polling, "parse_cpu", lambda raw: 10)
    monkeypatch.setattr(juniper_polling, "parse_memory", lambda raw: (8000, 2000, 25.0))

    def mock_parse_interfaces_crash(raw):
        raise TypeError("Unexpected NoneType in interface fields")
        
    monkeypatch.setattr(juniper_polling, "parse_interfaces", mock_parse_interfaces_crash)

    mock_client = MagicMock(spec=httpx.AsyncClient)
    result = await juniper_polling.poll_juniper_device_async(mock_device, mock_client)

    assert result["status"] == "up"
    assert result["cpu"] == 10
    assert result["total_memory"] == 8000
    assert result["used_memory"] == 2000
    assert result["memory_pct"] == 25.0
    
    assert result["interfaces"] == []