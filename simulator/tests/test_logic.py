import pytest

from simulator import logic


def test_get_high_utilized_cpu_spike(monkeypatch):
    # Force spike branch (random.random() > 0.95)
    monkeypatch.setattr(logic.random, "random", lambda: 0.96)
    assert logic.get_high_utilized_cpu() == 100


def test_get_high_utilized_cpu_drop(monkeypatch):
    # Force drop branch (random.random() < 0.03)
    monkeypatch.setattr(logic.random, "random", lambda: 0.01)
    monkeypatch.setattr(logic.random, "gauss", lambda mu, sigma: 10)
    assert logic.get_high_utilized_cpu() == 10


def test_high_utilized_cpu_normal(monkeypatch):
    # Normal path for high CPU
    monkeypatch.setattr(logic.random, "random", lambda: 0.5)
    monkeypatch.setattr(logic.random, "gauss", lambda mu, sigma: 80)
    assert logic.get_high_utilized_cpu() == 80


def test_cpu_average_default(monkeypatch):
    # Normal path for average CPU
    monkeypatch.setattr(logic.random, "random", lambda: 0.5)
    monkeypatch.setattr(logic.random, "gauss", lambda mu, sigma: 45)
    assert logic.get_average_utilized_cpu() == 45


def test_cpu_average_spike(monkeypatch):
    # Force spike branch (random.random() > 0.95)
    monkeypatch.setattr(logic.random, "random", lambda: 0.96)
    monkeypatch.setattr(logic.random, "randint", lambda a, b: 85)
    assert logic.get_average_utilized_cpu() == 85


def test_cpu_average_drop(monkeypatch):
    # Force drop branch (random.random() < 0.03)
    monkeypatch.setattr(logic.random, "random", lambda: 0.01)
    monkeypatch.setattr(logic.random, "gauss", lambda mu, sigma: 10)
    
    assert logic.get_average_utilized_cpu() == 10


def test_cpu_low_default(monkeypatch):
    # Normal path for low CPU
    monkeypatch.setattr(logic.random, "random", lambda: 0.5)
    monkeypatch.setattr(logic.random, "gauss", lambda mu, sigma: 8)
    assert logic.get_low_utilized_cpu() == 8


def test_cpu_low_spike(monkeypatch):
    # Force little spike branch (random.random() > 0.95)
    monkeypatch.setattr(logic.random, "random", lambda: 0.96)
    monkeypatch.setattr(logic.random, "randint", lambda a, b: 15)
    assert logic.get_low_utilized_cpu() == 15


def test_cpu_low_big_spike(monkeypatch):
    # Force big spike branch (random.random() < 0.01)
    monkeypatch.setattr(logic.random, "random", lambda: 0.005)
    monkeypatch.setattr(logic.random, "gauss", lambda mu, sigma: 80)
    assert logic.get_low_utilized_cpu() == 80


def test_ram_functions_deterministic(monkeypatch):
    # Make gauss return mean to make outputs deterministic
    monkeypatch.setattr(logic.random, "gauss", lambda mu, sigma: mu)

    total = 1000
    assert logic.get_high_utilized_ram(total) == int(total * 0.7)
    assert logic.get_average_utilized_ram(total) == int(total * 0.5)
    assert logic.get_low_utilized_ram(total) == int(total * 0.3)


def test_get_dynamic_interval(monkeypatch):
    # Control time progression
    times = iter([100.0, 105.5])
    monkeypatch.setattr(logic, "time", lambda: next(times))

    # First call has no previous time
    assert logic.get_dynamic_interval("k1") == 0.0
    # Second call returns difference
    assert logic.get_dynamic_interval("k1") == pytest.approx(5.5)


def test_increase_interface_counter(monkeypatch):
    # Control interval and utilization to compute exact increment
    monkeypatch.setattr(logic, "get_dynamic_interval", lambda key: 2.0)
    monkeypatch.setattr(logic.random, "uniform", lambda a, b: 0.3)

    prev = 100
    declared_speed = 8_000_000_000
    res = logic.increase_interface_counter(prev, declared_speed, "k")
    expected_increment = int((declared_speed / 8) * 0.3 * 2.0)
    assert res == prev + expected_increment


def test_increase_interface_counter_high_util(monkeypatch):
    monkeypatch.setattr(logic, "get_dynamic_interval", lambda key: 1.5)
    monkeypatch.setattr(logic.random, "uniform", lambda a, b: 0.8)

    prev = 0
    declared_speed = 1_000_000_000
    res = logic.increase_interface_counter_for_higher_utilized(prev, declared_speed, "k")
    expected_increment = int((declared_speed / 8) * 0.8 * 1.5)
    assert res == expected_increment
