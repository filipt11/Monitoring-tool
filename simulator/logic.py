"""Randomized utilization and traffic-counter logic for the device simulator.

Provides CPU and memory percentage generators for high, average, and low
utilization profiles, plus a configurable :class:`CustomProfile` model.
Interface byte counters grow proportionally to link speed and elapsed time
since the previous poll.

Attributes:
    last_sim_times (dict[str, float]): Timestamp of the last counter update
        per key, used by :func:`get_dynamic_interval` to compute elapsed
        seconds between successive calls.
"""

import random
from time import time
from pydantic import BaseModel, field_validator, model_validator
from typing import Any

last_sim_times: dict[str, float] = {}


class CustomProfile(BaseModel):
    """Pydantic model defining a custom CPU/memory utilization distribution.

    Values are expressed as percentages in the range ``0``–``100``. Spike and
    drop probabilities must sum to at most ``100``. Used by
    :class:`~simulator.devices.customUtilizedCiscoDevice` and
    :class:`~simulator.devices.customUtilizedJuniperDevice`.

    Attributes:
        mean (float): Centre of the normal distribution for baseline
            utilization. Default: ``30.0``.
        deviation (float): Standard deviation for baseline utilization.
            Default: ``5.0``.
        min_val (int): Lower bound for baseline utilization samples.
            Default: ``1``.
        max_val (int): Upper bound for baseline utilization samples.
            Default: ``100``.
        spike_chance_pct (float): Probability (``0``–``100``) of a spike event
            on each call. Default: ``3.0``.
        spike_min (int): Minimum spike utilization percentage.
            Default: ``50``.
        spike_max (int): Maximum spike utilization percentage.
            Default: ``100``.
        spike_mean (float): Centre of the normal distribution during a spike.
            Default: ``75.0``.
        spike_deviation (float): Standard deviation during a spike.
            Default: ``10.0``.
        drop_chance_pct (float): Probability (``0``–``100``) of a drop event
            on each call. Default: ``1.0``.
        drop_min (int): Minimum drop utilization percentage.
            Default: ``1``.
        drop_max (int): Maximum drop utilization percentage.
            Default: ``10``.
        drop_mean (float): Centre of the normal distribution during a drop.
            Default: ``5.0``.
        drop_deviation (float): Standard deviation during a drop.
            Default: ``2.0``.
    """

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
        """Clamp every numeric field to the range ``0``–``100``.

        Args:
            v: Field value after Pydantic coercion.

        Returns:
            The input value, clamped to ``[0, 100]`` when it is numeric.
        """
        if v < 0:
            return 0
        if v > 100:
            return 100
        return v

    @model_validator(mode="after")
    def validate_total_chance(self) -> "CustomProfile":
        """Ensure combined spike and drop probability does not exceed 100%.

        Returns:
            The validated profile instance.

        Raises:
            ValueError: When ``spike_chance_pct + drop_chance_pct`` exceeds
                ``100``.
        """
        total_chance = self.spike_chance_pct + self.drop_chance_pct
        if total_chance > 100:
            raise ValueError(
                f"chance for spike and drop cannot exceed 100% in total"
            )
        return self


def get_high_utilized_cpu() -> int:
    """Simulate CPU usage for a persistently high-utilization device.

    Distribution:
        * ``5%`` chance: spike to ``100``.
        * ``3%`` chance: drop to a Gaussian around ``40`` (minimum ``5``).
        * Otherwise: Gaussian around ``85`` (clamped to ``70``–``100``).

    Returns:
        Integer CPU utilization percentage in the range ``0``–``100``.
    """
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
    """Simulate CPU usage for an average-utilization device.

    Distribution:
        * ``5%`` chance: spike to ``60``–``100``.
        * ``3%`` chance: drop to a Gaussian around ``20`` (minimum ``5``).
        * Otherwise: Gaussian around ``40`` (clamped to ``20``–``60``).

    Returns:
        Integer CPU utilization percentage in the range ``0``–``100``.
    """
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
    """Simulate CPU usage for a low-utilization device.

    Distribution:
        * ``5%`` chance: moderate spike to ``11``–``25``.
        * ``1%`` chance: large spike (Gaussian around ``70``, capped at ``100``).
        * Otherwise: Gaussian around ``8`` (clamped to ``1``–``20``).

    Returns:
        Integer CPU utilization percentage in the range ``0``–``100``.
    """
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
    """Simulate used memory for a high-utilization device.

    Samples from a Gaussian centred at ``70%`` of ``total_memory`` with
    ``1%`` relative standard deviation, then clamps to ``[0, total_memory]``.

    Args:
        total_memory: Total installed memory in bytes.

    Returns:
        Used memory in bytes, in the range ``0``–``total_memory``.
    """
    mu = total_memory * 0.7
    sigma = mu * 0.01
    val = random.gauss(mu, sigma)

    return int(max(0, min(total_memory, val)))


def get_average_utilized_ram(total_memory: int) -> int:
    """Simulate used memory for an average-utilization device.

    Samples from a Gaussian centred at ``50%`` of ``total_memory`` with
    ``1%`` relative standard deviation, then clamps to ``[0, total_memory]``.

    Args:
        total_memory: Total installed memory in bytes.

    Returns:
        Used memory in bytes, in the range ``0``–``total_memory``.
    """
    mu = total_memory * 0.5
    sigma = mu * 0.01
    val = random.gauss(mu, sigma)

    return int(max(0, min(total_memory, val)))


def get_low_utilized_ram(total_memory: int) -> int:
    """Simulate used memory for a low-utilization device.

    Samples from a Gaussian centred at ``30%`` of ``total_memory`` with
    ``1%`` relative standard deviation, then clamps to ``[0, total_memory]``.

    Args:
        total_memory: Total installed memory in bytes.

    Returns:
        Used memory in bytes, in the range ``0``–``total_memory``.
    """
    mu = total_memory * 0.3
    sigma = mu * 0.01
    val = random.gauss(mu, sigma)

    return int(max(0, min(total_memory, val)))


def get_dynamic_interval(key: str) -> float:
    """Return elapsed seconds since the last call with the same key.

    Updates :data:`last_sim_times` on every invocation. The first call for
    a given key returns ``0.0`` because no prior timestamp exists.

    Args:
        key: Unique identifier, typically
            ``"{hostname}_{interface_name}_{in|out}"``.

    Returns:
        Seconds elapsed since the previous call with ``key``, or ``0.0`` on
        the first call.
    """
    now = time()
    prev_time = last_sim_times.get(key)

    last_sim_times[key] = now

    if prev_time is None:
        return 0.0

    return now - prev_time


def increase_interface_counter(
    previous_value: int, declared_speed: int | float, key: str
) -> int:
    """Advance an interface byte counter at average utilization.

    Computes increment as::

        speed_bytes * uniform(0.20, 0.40) * interval

    where ``speed_bytes = declared_speed / 8`` and ``interval`` comes from
    :func:`get_dynamic_interval`.

    Args:
        previous_value: Current cumulative counter value in bytes.
        declared_speed: Interface link speed in bits per second.
        key: Counter identifier passed to :func:`get_dynamic_interval`
            (e.g. ``"r-high-1_Vlan2_in"``).

    Returns:
        ``previous_value`` plus the computed increment (always ``>=``
        ``previous_value`` when ``interval > 0``).
    """
    interval = get_dynamic_interval(key)
    speed_bytes = declared_speed / 8
    utilization = random.uniform(0.20, 0.40)
    increment = int(speed_bytes * utilization * interval)

    return previous_value + increment


def increase_interface_counter_for_higher_utilized(
    previous_value: int, declared_speed: int | float, key: str
) -> int:
    """Advance an interface byte counter at high utilization.

    Same algorithm as :func:`increase_interface_counter` but samples
    utilization uniformly from ``0.75``–``0.95``.

    Args:
        previous_value: Current cumulative counter value in bytes.
        declared_speed: Interface link speed in bits per second.
        key: Counter identifier passed to :func:`get_dynamic_interval`
            (e.g. ``"r-high-1_Vlan2_in"``).

    Returns:
        ``previous_value`` plus the computed increment (always ``>=``
        ``previous_value`` when ``interval > 0``).
    """
    interval = get_dynamic_interval(key)
    speed_bytes = declared_speed / 8
    utilization = random.uniform(0.75, 0.95)
    increment = int(speed_bytes * utilization * interval)

    return previous_value + increment


def get_custom_utilized_cpu(
    profile: CustomProfile
) -> int:
    """Simulate CPU usage using a :class:`CustomProfile` distribution.

    On each call a random value selects one of three scenarios:

    * **Spike** (probability ``spike_chance_pct``): Gaussian around
      ``spike_mean``, clamped to ``[spike_min, spike_max]``.
    * **Drop** (probability ``drop_chance_pct``): Gaussian around
      ``drop_mean``, clamped to ``[drop_min, drop_max]``.
    * **Normal** (remaining probability): Gaussian around ``mean``,
      clamped to ``[min_val, max_val]``.

    Args:
        profile: Utilization parameters defining means, bounds, and event
            probabilities.

    Returns:
        Integer CPU utilization percentage.
    """
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
    """Simulate used memory using a :class:`CustomProfile` distribution.

    Uses the same three-scenario model as :func:`get_custom_utilized_cpu`,
    then converts the resulting percentage to bytes::

        int((result / 100) * total_memory)

    Args:
        total_memory: Total installed memory in bytes.
        profile: Utilization parameters defining means, bounds, and event
            probabilities.

    Returns:
        Used memory in bytes derived from the sampled utilization percentage.
    """
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
