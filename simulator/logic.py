from dataclasses import dataclass
import random
from time import time
from pydantic import BaseModel, field_validator, model_validator
from typing import Any

last_sim_times: dict[str, float] = {}


class CustomProfile(BaseModel):
    """Custom profile used to build utilization logic for custom utilized devices"""

    # Normal
    mean: float = 30.0
    deviation: float = 5.0
    min_val: int = 1
    max_val: int = 100

    # Spikes
    spike_chance_pct: float = 3.0
    spike_min: int = 50
    spike_max: int = 100
    spike_mean: float = 75.0
    spike_deviation: float = 10.0

    # Drops
    drop_chance_pct: float = 1.0
    drop_min: int = 1
    drop_max: int = 10
    drop_mean: float = 5.0
    drop_deviation: float = 2.0

    @field_validator("*", mode="after")
    @classmethod
    def clamp_values_0_100(cls, v: Any) -> Any:
        """function to clamp values between 0 and 100."""
        if v < 0:
            return 0
        if v > 100:
            return 100
        return v

    @model_validator(mode="after")
    def validate_total_chance(self) -> "CustomProfile":
        """function to validate total chance for spike and drop."""
        
        total_chance = self.spike_chance_pct + self.drop_chance_pct
        if total_chance > 100:
            raise ValueError(
                f"chance for spike and drop cannot exceed 100% in total"
            )
        return self

def get_high_utilized_cpu() -> int:
    """Simulate values of usage for permanently high utilized CPU with occasionally drops"""

    r = random.random()

    # 5% chance for 100% spike
    if r > 0.95:
        return 100

    # 3% chance for drop
    elif r < 0.03:
        return int(max(5, random.gauss(40, 30)))
    
    else:
        val = random.gauss(85, 10)
        return int(max(70, min(100, val)))


def get_average_utilized_cpu() -> int:
    """Simulate values of usage for average utilized CPU with occasional deviations"""
    
    r = random.random()

    # 5% chance for spike
    if r > 0.95:
        return random.randint(60, 100)

    # 3% chance for drop
    elif r < 0.03:
        return int(max(5, random.gauss(20, 20)))

    else:
        val = random.gauss(40, 7)
        return int(max(20, min(60, val)))


def get_low_utilized_cpu() -> int:
    """Simulate values of usage for low utilized CPU with occasional spikes"""
    
    r = random.random()

    # 5% chance for spike
    if r > 0.95:
        return random.randint(11, 25)

    # 1% chance for big spike
    elif r < 0.01:
        return min(100, int(max(0, random.gauss(70, 20))))

    else:
        val = random.gauss(8, 3)
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


def get_custom_utilized_cpu(
    profile: CustomProfile
) -> int:
    """Simulate values of usage for CPU with custom utilization pattern"""

    r = random.random()
    # spike scenario
    if r > 1 - profile.spike_chance_pct / 100:
        val = random.gauss(profile.spike_mean, profile.spike_deviation)
        result = max(profile.spike_min, min(profile.spike_max, val))

    # drop scenario
    elif r < profile.drop_chance_pct / 100:
        val = random.gauss(profile.drop_mean, profile.drop_deviation)
        result = max(profile.drop_min, min(profile.drop_max, val))

    # normal scenario
    else:
        val = random.gauss(profile.mean, profile.deviation)
        result = (max(profile.min_val, min(profile.max_val, val)))

    return int(result)


def get_custom_utilized_ram(
 total_memory: int, profile: CustomProfile
) -> int:
    """Simulate values of usage for RAM with custom utilization pattern"""

    r = random.random()
    
    # spike scenario
    if r > 1 - profile.spike_chance_pct / 100:
        val = random.gauss(profile.spike_mean, profile.spike_deviation)
        result = max(profile.spike_min, min(profile.spike_max, val))

    # drop scenario
    elif r < profile.drop_chance_pct / 100:
        val = random.gauss(profile.drop_mean, profile.drop_deviation)
        result = max(profile.drop_min, min(profile.drop_max, val))
    
    # standard scenario
    else:
        val = random.gauss(profile.mean, profile.deviation)
        result = max(profile.min_val, min(profile.max_val, val))

    return int((result / 100) * total_memory)
