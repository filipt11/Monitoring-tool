import random
from time import time

last_sim_times: dict[str, float] = {}


def get_high_utilized_cpu() -> int:
    """Simulate values of usage for permanently high utilized CPU with occasionally drops"""

    val = random.gauss(85, 10)

    # 5% chance for 100% spike
    if random.random() > 0.95:
        return 100

    # 3% chance for drop
    if random.random() < 0.03:
        return int(max(5, random.gauss(40, 30)))

    return int(max(70, min(100, val)))


def get_average_utilized_cpu() -> int:
    """Simulate values of usage for average utilized CPU with occasionally devation"""

    val = random.gauss(40, 7)

    # 5% chance for spike
    if random.random() > 0.95:
        return random.randint(60, 100)

    # 3% chance for drop
    if random.random() < 0.03:
        return int(max(5, random.gauss(20, 20)))

    return int(max(20, min(60, val)))


def get_low_utilized_cpu() -> int:
    """Simulate values of usage for low utilized CPU with occasionally spike"""

    val = random.gauss(8, 3)

    # 5% chance for little spike
    if random.random() > 0.95:
        return random.randint(11, 25)

    # 1% chance for big spike
    if random.random() < 0.01:
        return min(100, int(max(0, random.gauss(70, 20))))

    return int(max(1, min(20, val)))


def get_high_utilized_ram(total_memory: int) -> int:
    """Simulate values of usage for high utilized RAM"""

    mu = total_memory * 0.7
    sigma = mu * 0.01
    val = random.gauss(mu, sigma)

    return int(max(0, min(total_memory, val)))


def get_average_utilized_ram(total_memory: int) -> int:
    """Simulate values of usage for average utilized RAM"""

    mu = total_memory * 0.5
    sigma = mu * 0.01
    val = random.gauss(mu, sigma)

    return int(max(0, min(total_memory, val)))


def get_low_utilized_ram(total_memory: int) -> int:
    """Simulate values of usage for low utilized RAM"""

    mu = total_memory * 0.3
    sigma = mu * 0.01
    val = random.gauss(mu, sigma)

    return int(max(0, min(total_memory, val)))


def get_dynamic_interval(key: str) -> float:
    """Calculate how much time passed since last polling"""

    now = time()
    prev_time = last_sim_times.get(key)

    last_sim_times[key] = now

    if prev_time is None:
        return 0.0

    return now - prev_time


def increase_interface_counter(
    previous_value: int, declared_speed: int | float, key: str
) -> int:
    """Simulate values of counter for average utilized interfaces

    previous_value - previous value of counter
    declared_speed - interface speed
    key - identifier of deivce and its interface with optional in/out sufix(for example: r-high-1_Vlan2_in)
    """

    interval = get_dynamic_interval(key)
    speed_bytes = declared_speed / 8
    utilization = random.uniform(0.20, 0.40)
    increment = int(speed_bytes * utilization * interval)

    return previous_value + increment


def increase_interface_counter_for_higher_utilized(
    previous_value: int, declared_speed: int | float, key: str
) -> int:
    """Simulate values of counter for higher utilized interfaces

    previous_value - previous value of counter
    declared_speed - interface speed
    key - identifier of deivce and its interface with optional in/out sufix(for example: r-high-1_Vlan2_in)
    """

    interval = get_dynamic_interval(key)
    speed_bytes = declared_speed / 8
    utilization = random.uniform(0.75, 0.95)
    increment = int(speed_bytes * utilization * interval)

    return previous_value + increment
