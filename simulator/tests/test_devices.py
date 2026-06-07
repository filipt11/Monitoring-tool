from simulator import devices, logic


def test_base_cisco_device_cpu_and_memory(monkeypatch):
    monkeypatch.setattr(logic, "get_average_utilized_cpu", lambda: 42)
    monkeypatch.setattr(logic, "get_average_utilized_ram", lambda total: 1234)

    dev = devices.BaseCiscoDevice(
        "127.0.0.1", "cisco", "host1", "model", "user", "pass", 8001, False
    )

    assert dev.get_cpu() == 42
    assert dev.get_used_memory() == 1234


def test_high_utilized_cisco_device_cpu_and_memory(monkeypatch):
    monkeypatch.setattr(logic, "get_high_utilized_cpu", lambda: 84)
    monkeypatch.setattr(logic, "get_high_utilized_ram", lambda total: 5678)

    dev = devices.HighUtilizedCiscoDevice(
        "127.0.0.1", "cisco", "host1", "model", "user", "pass", 8001, False
    )

    assert dev.get_cpu() == 84
    assert dev.get_used_memory() == 5678


def test_low_utilized_cisco_device_cpu_and_memory(monkeypatch):
    monkeypatch.setattr(logic, "get_low_utilized_cpu", lambda: 21)
    monkeypatch.setattr(logic, "get_low_utilized_ram", lambda total: 4321)

    dev = devices.LowUtilizedCiscoDevice(
        "127.0.0.1", "cisco", "host1", "model", "user", "pass", 8001, False
    )

    assert dev.get_cpu() == 21
    assert dev.get_used_memory() == 4321


def test_average_utilized_cisco_device_cpu_and_memory(monkeypatch):
    monkeypatch.setattr(logic, "get_average_utilized_cpu", lambda: 63)
    monkeypatch.setattr(logic, "get_average_utilized_ram", lambda total: 7890)

    dev = devices.AverageUtilizedCiscoDevice(
        "127.0.0.1", "cisco", "host1", "model", "user", "pass", 8001, False
    )

    assert dev.get_cpu() == 63
    assert dev.get_used_memory() == 7890


def test_base_juniper_device_cpu_and_memory(monkeypatch):
    monkeypatch.setattr(logic, "get_average_utilized_cpu", lambda: 55)
    monkeypatch.setattr(logic, "get_average_utilized_ram", lambda total: 2468)

    dev = devices.BaseJuniperDevice(
        "127.0.0.1", "juniper", "host1", "model", "user", "pass", 8001, False
    )

    assert dev.get_cpu() == 55
    assert dev.get_used_memory() == 2468

def test_high_utilized_juniper_device_cpu_and_memory(monkeypatch):
    monkeypatch.setattr(logic, "get_high_utilized_cpu", lambda: 77)
    monkeypatch.setattr(logic, "get_high_utilized_ram", lambda total: 1357)

    dev = devices.HighUtilizedJuniperDevice(
        "127.0.0.1", "juniper", "host1", "model", "user", "pass", 8001, False
    )

    assert dev.get_cpu() == 77
    assert dev.get_used_memory() == 1357


def test_low_utilized_juniper_device_cpu_and_memory(monkeypatch):
    monkeypatch.setattr(logic, "get_low_utilized_cpu", lambda: 33)
    monkeypatch.setattr(logic, "get_low_utilized_ram", lambda total: 8642)

    dev = devices.LowUtilizedJuniperDevice(
        "127.0.0.1", "juniper", "host1", "model", "user", "pass", 8001, False
    )

    assert dev.get_cpu() == 33
    assert dev.get_used_memory() == 8642


def test_average_utilized_juniper_device_cpu_and_memory(monkeypatch):
    monkeypatch.setattr(logic, "get_average_utilized_cpu", lambda: 44)
    monkeypatch.setattr(logic, "get_average_utilized_ram", lambda total: 9753)

    dev = devices.AverageUtilizedJuniperDevice(
        "127.0.0.1", "juniper", "host1", "model", "user", "pass", 8001, False
    )

    assert dev.get_cpu() == 44
    assert dev.get_used_memory() == 9753


def test_interfaces_update_with_stubbed_counters(monkeypatch):
    monkeypatch.setattr(logic, "increase_interface_counter", lambda prev, speed, key: prev + 100)
    monkeypatch.setattr(logic, "increase_interface_counter_for_higher_utilized", lambda prev, speed, key: prev + 200)

    dev = devices.BaseCiscoDevice("1.2.3.4", "cisco", "myhost", "model", "user", "pass", 8001, False)
    out = dev.get_interfaces()


    assert isinstance(out, list)
    assert len(out) >= 1
    for iface in out:
        assert "in-octets" in iface and "out-octets" in iface
        int(iface["in-octets"])
        int(iface["out-octets"])
