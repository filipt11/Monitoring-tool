from poller import main
import pytest
from unittest.mock import MagicMock, AsyncMock, ANY, patch
import asyncio

def test_get_current_devices_success(monkeypatch):
    # Test that get_current_devices successfully retrieves and returns a list of devices from the database session
    mock_session_instance = MagicMock()
    mock_session_instance.__enter__.return_value = mock_session_instance

    mock_session_cls = MagicMock(return_value=mock_session_instance)
    monkeypatch.setattr(main, "Session", mock_session_cls)

    mock_device_1 = MagicMock()
    mock_device_2 = MagicMock()
    expected_devices = [mock_device_1, mock_device_2]

    mock_session_instance.query.return_value.all.return_value = expected_devices

    result = main.get_current_devices()

    assert result == expected_devices
    assert len(result) == 2

    mock_session_instance.query.assert_called_once_with(main.Device)
    mock_session_instance.query.return_value.all.assert_called_once()


@pytest.fixture(autouse=True)
def setup_safe_semaphore(monkeypatch):
    # Fixture to ensure that the semaphore used in poll_single_device is reset to a known state before each test, preventing interference between tests that may exhaust the semaphore
    monkeypatch.setattr(main, "semaphore", asyncio.Semaphore(10))


@pytest.mark.asyncio
async def test_poll_single_device_cisco_up_with_interfaces(monkeypatch):
    # Test that poll_single_device correctly polls a Cisco device that is up and has interfaces, saving both device data and interface data to the database
    device = MagicMock()
    device.vendor = "cisco"
    device.id = 101
    device.hostname = "cisco-core-01"
    device.ip = "10.1.1.1"

    mock_network_data = {
        "cpu": 24,
        "memory_pct": 60,
        "total_memory": 16000,
        "used_memory": 9600,
        "interfaces": [{"name": "Gi0/1", "status": "up"}, {"name": "Gi0/2", "status": "down"}]
    }
    mock_poll_cisco = AsyncMock(return_value=mock_network_data)
    monkeypatch.setattr(main, "poll_cisco_device_async", mock_poll_cisco)

    mock_save_device = MagicMock()
    mock_save_interfaces = MagicMock()
    monkeypatch.setattr(main, "save_polled_device_data", mock_save_device)
    monkeypatch.setattr(main, "save_polled_interface_data", mock_save_interfaces)

    fake_client = MagicMock()
    await main.poll_single_device(device, fake_client)

    mock_poll_cisco.assert_called_once_with(device, fake_client)
    
    mock_save_device.assert_called_once()
    assert mock_save_device.call_args[1]["status"] == 1
    
    mock_save_interfaces.assert_called_once_with(
        101, "cisco-core-01", "10.1.1.1", mock_network_data["interfaces"]
    )


@pytest.mark.asyncio
async def test_poll_single_device_juniper_up_no_interfaces(monkeypatch):
    # Test that poll_single_device correctly polls a Juniper device that is up but has no interfaces, saving only the device data with status 1 and not attempting to save any interface data
    device = MagicMock()
    device.vendor = "juniper"
    device.id = 202
    device.hostname = "juniper-edge"
    device.ip = "10.2.2.2"

    mock_network_data = {
        "cpu": 12,
        "memory_pct": None,
    }
    monkeypatch.setattr(main, "poll_juniper_device_async", AsyncMock(return_value=mock_network_data))

    mock_save_device = MagicMock()
    mock_save_interfaces = MagicMock()
    monkeypatch.setattr(main, "save_polled_device_data", mock_save_device)
    monkeypatch.setattr(main, "save_polled_interface_data", mock_save_interfaces)

    await main.poll_single_device(device, MagicMock())

    assert mock_save_device.call_args[1]["status"] == 1
    mock_save_interfaces.assert_not_called()


@pytest.mark.asyncio
async def test_poll_single_device_down_status(monkeypatch):
    # Test that poll_single_device correctly handles a device that is down (no CPU or memory data), saving the device data with status 0 and not attempting to save any interface data
    device = MagicMock()
    device.vendor = "cisco"
    
    monkeypatch.setattr(main, "poll_cisco_device_async", AsyncMock(return_value={}))

    mock_save_device = MagicMock()
    monkeypatch.setattr(main, "save_polled_device_data", mock_save_device)

    await main.poll_single_device(device, MagicMock())

    mock_save_device.assert_called_once()
    assert mock_save_device.call_args[1]["status"] == 0


@pytest.mark.asyncio
async def test_poll_single_device_unsupported_vendor(monkeypatch):
    # Test that poll_single_device does not attempt to poll or save data for a device with an unsupported vendor, and that it simply returns without error
    device = MagicMock()
    device.vendor = "fortinet"

    mock_save_device = MagicMock()
    monkeypatch.setattr(main, "save_polled_device_data", mock_save_device)

    await main.poll_single_device(device, MagicMock())

    mock_save_device.assert_not_called()


@pytest.mark.asyncio
async def test_poll_single_device_handles_exception(monkeypatch):
    # Test that poll_single_device properly handles exceptions raised during polling (e.g., due to unexpected data formats) by logging the error and not attempting to save any data, ensuring that the exception does not propagate and cause the function to fail
    device = MagicMock()
    device.vendor = "cisco"
    device.hostname = "broken-device"

    async def mock_crash(*args, **kwargs):
        raise ValueError("Unexpected XML payload structure")

    monkeypatch.setattr(main, "poll_cisco_device_async", mock_crash)

    mock_save_device = MagicMock()
    monkeypatch.setattr(main, "save_polled_device_data", mock_save_device)

    try:
        await main.poll_single_device(device, MagicMock())
    except Exception as e:
        pytest.fail(f"{e}")

    mock_save_device.assert_not_called()


@pytest.mark.asyncio
async def test_poll_devices_main_postgres_success(monkeypatch):
    # Test that poll_devices_main successfully retrieves the current devices from the database and calls poll_single_device for each device, updating the cached_device_list with the retrieved devices
    main.cached_device_list = []

    mock_devices = [MagicMock(id=1, hostname="R1"), MagicMock(id=2, hostname="R2")]
    monkeypatch.setattr(main, "get_current_devices", lambda: mock_devices)

    mock_poll_single = AsyncMock()
    monkeypatch.setattr(main, "poll_single_device", mock_poll_single)

    await main.poll_devices_main()

    assert main.cached_device_list == mock_devices
    assert mock_poll_single.call_count == 2


@pytest.mark.asyncio
async def test_poll_devices_main_postgres_failure_uses_cache(monkeypatch):
    # Test that if get_current_devices raises an exception (simulating a PostgreSQL connection failure), poll_devices_main uses the existing cached_device_list and still calls poll_single_device for each device in the cache, ensuring that the function can continue to operate using cached data even when the database is unavailable
    old_cached_device = MagicMock(id=99, hostname="Old-Reliable")
    main.cached_device_list = [old_cached_device]

    def mock_db_crash():
        raise Exception("PostgreSQL Connection Refused")
    monkeypatch.setattr(main, "get_current_devices", mock_db_crash)

    mock_poll_single = AsyncMock()
    monkeypatch.setattr(main, "poll_single_device", mock_poll_single)

    await main.poll_devices_main()

    assert main.cached_device_list == [old_cached_device]
    mock_poll_single.assert_called_once_with(old_cached_device, ANY)


@pytest.fixture
def mock_influx_config(monkeypatch):
    # Fixture to mock the InfluxDB client configuration for testing the save_polled_device_data function, allowing us to verify that the correct data is being written to InfluxDB without actually connecting to a real database
    mock_write_api = MagicMock()
    monkeypatch.setattr(main, "write_api", mock_write_api)
    monkeypatch.setattr(main, "INFLUX_BUCKET", "test_bucket")
    monkeypatch.setattr(main, "INFLUX_ORG", "test_org")
    return mock_write_api


def test_save_polled_device_data_status_up_all_metrics(mock_influx_config):
    # Test that save_polled_device_data correctly constructs and writes a Point to InfluxDB with all expected fields when the device is up and all metrics are provided, ensuring that the correct tags and fields are included in the Point based on the device data
    device = MagicMock()
    device.id = 10
    device.hostname = "Core-Switch"
    device.ip = "10.0.0.10"
    device.cpu_usage = 45
    device.memory_total = 16000
    device.memory_usage = 8000
    device.memory_usage_pct = 50.0

    main.save_polled_device_data(device, status=1)

    mock_influx_config.write.assert_called_once()
    called_bucket = mock_influx_config.write.call_args[1]["bucket"]
    called_org = mock_influx_config.write.call_args[1]["org"]
    called_point = mock_influx_config.write.call_args[1]["record"]

    assert called_bucket == "test_bucket"
    assert called_org == "test_org"

    assert called_point._name == "device_statistics"
    assert called_point._tags["id"] == 10
    assert called_point._tags["hostname"] == "Core-Switch"
    assert called_point._tags["ip"] == "10.0.0.10"
    
    assert called_point._fields["status"] == 1
    assert called_point._fields["cpu_usage"] == 45
    assert called_point._fields["memory_total"] == 16000
    assert called_point._fields["memory_usage_pct"] == 50.0


def test_save_polled_device_data_status_up_partial_metrics(mock_influx_config):
    # Test that save_polled_device_data correctly constructs and writes a Point to InfluxDB with only the available fields when the device is up but some metrics are missing (e.g., memory_total is None), ensuring that only the provided metrics are included in the Point and that missing metrics are not included as fields in the Point, while still including the status field with value 1
    device = MagicMock()
    device.id = 11
    device.hostname = "Edge-Router"
    device.ip = "10.0.0.11"
    device.cpu_usage = 15
    device.memory_total = None
    device.memory_usage = None
    device.memory_usage_pct = None 

    main.save_polled_device_data(device, status=1)

    called_point = mock_influx_config.write.call_args[1]["record"]

    assert called_point._fields["cpu_usage"] == 15
    assert "memory_total" not in called_point._fields
    assert "memory_usage_pct" not in called_point._fields


def test_save_polled_device_data_status_down(mock_influx_config):
    # Test that save_polled_device_data correctly constructs and writes a Point to InfluxDB with only the status field when the device is down (status=0), ensuring that no other metrics are included in the Point and that the status field is set to 0, indicating that the device is down, while also verifying that the correct tags are still included based on the device information
    device = MagicMock()
    device.id = 12
    device.hostname = "Dead-Switch"
    device.ip = "10.0.0.12"
    device.cpu_usage = 99  

    main.save_polled_device_data(device, status=0)

    called_point = mock_influx_config.write.call_args[1]["record"]

    assert called_point._fields["status"] == 0
    assert "cpu_usage" not in called_point._fields
    assert "memory_total" not in called_point._fields


def test_save_polled_interface_data_up_with_metrics(mock_influx_config, monkeypatch):
    # Test that save_polled_interface_data correctly constructs and writes a Point to InfluxDB with all expected fields when the interface is up and all metrics are provided, ensuring that the correct tags and fields are included in the Point based on the interface data, and that the calculate_utilization function is called to compute the in_bps and in_util_pct fields when the admin status is up, while also verifying that the correct number of calls to calculate_utilization are made based on the number of interfaces being processed
    mock_calculate_util = MagicMock(return_value=(1500.0, 15.5))
    monkeypatch.setattr(main, "calculate_utilization", mock_calculate_util)

    interfaces_raw = [
        {
            "name": "GigabitEthernet0/1",
            "if_index": "1",
            "admin_status": "up",
            "oper_status": "up",
            "speed": "100000000",
            "in_octets": "50000",
            "out_octets": "60000"
        }
    ]

    main.save_polled_interface_data(
        device_id=101,
        device_hostname="Core-Switch-01",
        device_ip="10.0.0.1",
        interfaces_raw=interfaces_raw
    )

    mock_influx_config.write.assert_called_once()
    called_points = mock_influx_config.write.call_args[1]["record"]
    
    assert len(called_points) == 1
    p = called_points[0]

    assert p._name == "interface_statistics"
    assert str(p._tags["device_id"]) == "101"
    assert p._tags["hostname"] == "Core-Switch-01"
    assert p._tags["if_name"] == "GigabitEthernet0/1"
    assert p._tags["if_index"] == "1"

    assert p._fields["admin_status"] == 1
    assert p._fields["oper_status"] == 1
    assert p._fields["speed_bps"] == 100000000
    assert p._fields["in_octets"] == 50000
    assert p._fields["in_bps"] == 1500.0
    assert p._fields["in_util_pct"] == 15.5

    assert mock_calculate_util.call_count == 2


def test_save_polled_interface_data_admin_down(mock_influx_config, monkeypatch):
    # Test that save_polled_interface_data correctly constructs and writes a Point to InfluxDB with only the admin_status and oper_status fields when the interface admin status is down, ensuring that the in_octets, in_bps, and in_util_pct fields are not included in the Point when the admin status is down, while still including the correct tags and other fields based on the provided interface data, and verifying that the calculate_utilization function is not called when the admin status is down since utilization cannot be calculated for an interface that is administratively down
    mock_calculate_util = MagicMock()
    monkeypatch.setattr(main, "calculate_utilization", mock_calculate_util)

    interfaces_raw = [
        {
            "name": "GigabitEthernet0/2",
            "if_index": "2",
            "admin_status": "down",
            "oper_status": "down",
            "speed": "100000000",
            "in_octets": "999999"
        }
    ]

    main.save_polled_interface_data(
        device_id=101,
        device_hostname="Core-Switch-01",
        device_ip="10.0.0.1",
        interfaces_raw=interfaces_raw
    )

    called_points = mock_influx_config.write.call_args[1]["record"]
    p = called_points[0]

    assert p._fields["admin_status"] == 0
    assert p._fields["oper_status"] == 0

    assert "in_octets" not in p._fields
    assert "in_bps" not in p._fields
    assert "in_util_pct" not in p._fields
    
    mock_calculate_util.assert_not_called()


def test_save_polled_interface_data_empty_list(mock_influx_config):
    # Test that save_polled_interface_data does not attempt to write any Points to InfluxDB when the interfaces_raw list is empty, ensuring that the function can handle an empty list of interfaces without error and that it does not call the write method on the InfluxDB client when there are no interfaces to process
    main.save_polled_interface_data(
        device_id=102,
        device_hostname="Edge-Router",
        device_ip="10.0.0.2",
        interfaces_raw=[]
    )
    mock_influx_config.write.assert_not_called()


@pytest.fixture(autouse=True)
def clean_last_polls_cache():
    # Fixture to clear the last_polls cache before and after each test, ensuring that tests that rely on the state of the last_polls cache start with a clean slate and do not interfere with each other by leaving residual data in the cache that could affect the outcome of subsequent tests, particularly those that test the calculate_utilization function which relies on the state of the last_polls cache to compute utilization based on previous poll data
    main.last_polls.clear()
    yield
    main.last_polls.clear()



def test_calculate_utilization_first_poll():
    # Test that calculate_utilization returns None for both bps and utilization on the first poll for a given interface (when there is no previous data in the last_polls cache), and that it correctly stores the current poll data in the last_polls cache for future calculations, ensuring that the function can handle the initial poll scenario without error and that it initializes the cache correctly for subsequent polls
    with patch("time.monotonic", return_value=100.0):
        bps, util = main.calculate_utilization(
            hostname="R1", if_name="Gi0/1", direction="in", current_octets=1000, speed_bps=100_000
        )


    assert bps is None
    assert util is None

    key = "R1_Gi0/1_in"
    assert key in main.last_polls
    assert main.last_polls[key] == (100.0, 1000)


def test_calculate_utilization_success_second_poll():
    # Test that calculate_utilization correctly calculates bps and utilization on the second poll for a given interface based on the previous data stored in the last_polls cache, ensuring that the function computes the correct values for bps and utilization based on the change in octets and time, and that it updates the last_polls cache with the new poll data for future calculations
    key = "R1_Gi0/1_in"
    

    main.last_polls[key] = (100.0, 10000)

    with patch("time.monotonic", return_value=110.0):
        bps, util = main.calculate_utilization(
            hostname="R1", if_name="Gi0/1", direction="in", current_octets=22500, speed_bps=100_000
        )

    assert bps == 10000.0
    assert util == 10.0

    assert main.last_polls[key] == (110.0, 22500)



def test_calculate_utilization_counter_reset():
    #  Test that calculate_utilization correctly handles a counter reset scenario (when the current octets value is less than the previous octets value), ensuring that the function detects the counter reset, logs a warning, returns None for both bps and utilization, and updates the last_polls cache with the new poll data to allow for correct calculations on subsequent polls after the reset
    key = "R1_Gi0/1_in"
    
    main.last_polls[key] = (100.0, 9999999)

    with patch("time.monotonic", return_value=110.0):
        bps, util = main.calculate_utilization(
            hostname="R1", if_name="Gi0/1", direction="in", current_octets=500, speed_bps=100_000
        )

    assert bps is None
    assert util is None

    assert main.last_polls[key] == (110.0, 500)



def test_calculate_utilization_zero_time_delta():
    # Test that calculate_utilization correctly handles a scenario where the time delta is zero (when the current poll occurs at the same time as the previous poll), ensuring that the function detects the zero time delta, returns None for both bps and utilization to avoid division by zero errors, and updates the last_polls cache with the new poll data for future calculations
    key = "R1_Gi0/1_in"
    main.last_polls[key] = (100.0, 1000)

    with patch("time.monotonic", return_value=100.0):
        bps, util = main.calculate_utilization(
            hostname="R1", if_name="Gi0/1", direction="in", current_octets=2000, speed_bps=100_000
        )

    assert bps is None
    assert util is None



def test_calculate_utilization_zero_speed_bps():
    # Test that calculate_utilization correctly handles a scenario where the speed_bps is zero, ensuring that the function computes the correct values for bps and utilization based on the change in octets and time, and that it updates the last_polls cache with the new poll data for future calculations, while also verifying that the utilization percentage is calculated as 0 when speed_bps is zero to avoid division by zero errors
    key = "R1_Gi0/1_in"
    main.last_polls[key] = (100.0, 1000)

    with patch("time.monotonic", return_value=110.0):
        bps, util = main.calculate_utilization(
            hostname="R1", if_name="Gi0/1", direction="in", current_octets=2000, speed_bps=0
        )

    assert bps == 800.0
    assert util == 0