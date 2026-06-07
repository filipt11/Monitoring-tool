from simulator import devices, logic


def test_average_device_cpu_and_memory(monkeypatch):
    monkeypatch.setattr(logic, "get_average_utilized_cpu", lambda: 42)
    monkeypatch.setattr(logic, "get_average_utilized_ram", lambda total: 1234)

    dev = devices.AverageUtilizedCiscoDevice(
        "127.0.0.1", "cisco", "host1", "model", "user", "pass", 8001, False
    )

    assert dev.get_cpu() == 42
    assert dev.get_used_memory() == 1234


def test_interfaces_update_with_stubbed_counters(monkeypatch):
    monkeypatch.setattr(logic, "increase_interface_counter", lambda prev, speed, key: prev + 100)
    monkeypatch.setattr(logic, "increase_interface_counter_for_higher_utilized", lambda prev, speed, key: prev + 200)

    dev = devices.BaseCiscoDevice("1.2.3.4", "cisco", "myhost", "m", "u", "p", 8001, False)
    out = dev.get_interfaces()


    assert isinstance(out, list)
    assert len(out) >= 1
    for iface in out:
        assert "in-octets" in iface and "out-octets" in iface
        int(iface["in-octets"])
        int(iface["out-octets"])
