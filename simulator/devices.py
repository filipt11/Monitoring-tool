"""Simulated network device models for Cisco and Juniper vendors.

Each concrete class represents a device with a specific utilization profile
(high, low, average, or custom). Devices expose :meth:`BaseDevice.get_cpu`,
:meth:`BaseDevice.get_used_memory`, :meth:`BaseDevice.get_total_memory`, and
:meth:`BaseDevice.get_interfaces` which the FastAPI layer in
:mod:`simulator.main` calls to build vendor-specific API responses.

Interface counters are stateful: each call to :meth:`BaseDevice.get_interfaces`
advances ``in-octets`` and ``out-octets`` based on interface speed and admin
status.
"""

from simulator import logic
from typing import Any, Optional
from simulator.logic import CustomProfile


class BaseDevice:
    """Abstract base model for a simulated network device.

    Stores connection metadata and maintains rolling interface byte counters.
    Subclasses override metric methods and populate :attr:`interfaces_list`
    with vendor-specific interface definitions.

    Attributes:
        ip_address (str): Simulated management IP address.
        vendor (str): Device vendor identifier (``cisco`` or ``juniper``).
        hostname (str): Device hostname returned by API endpoints.
        model (str): Hardware model string returned in inventory responses.
        username (str): Expected HTTP Basic authentication username.
        password (str): Expected HTTP Basic authentication password.
        port (int): TCP port the simulator listens on.
        https (bool): Whether the device is configured for HTTPS access.
        interface_counters (dict[str, int]): Rolling byte counters keyed as
            ``"{interface_name}_in"`` and ``"{interface_name}_out"``.
        interfaces_list (list[dict[str, Any]]): Static interface definitions.
            Each dict contains ``name``, ``type``, ``admin-status``,
            ``if-index``, ``phys-address``, and ``speed`` (bits per second as
            a string).
    """

    def __init__(
        self, ip_address: str, vendor: str, hostname: str, model: str, username: str, password: str, port: int, https: bool
    ) -> None:
        """Initialize a simulated device with connection metadata.

        Args:
            ip_address: Simulated management IP address.
            vendor: Device vendor (``cisco`` or ``juniper``).
            hostname: Hostname exposed via vendor API endpoints.
            model: Hardware model string for inventory responses.
            username: HTTP Basic auth username expected by the simulator.
            password: HTTP Basic auth password expected by the simulator.
            port: TCP port for the simulator HTTP server.
            https: Whether the device is flagged as using HTTPS.
        """
        self.ip_address: str = ip_address
        self.vendor: str = vendor
        self.hostname: str = hostname
        self.model: str = model
        self.username: str = username
        self.password: str = password
        self.port: int = port
        self.https: bool = https
        self.interface_counters: dict[str, int] = {}
        self.interfaces_list: list[dict[str, Any]] = []

    def get_cpu(self) -> int:
        """Return the current simulated CPU utilization percentage.

        Returns:
            Integer CPU usage in the range ``0``–``100``. The base
            implementation delegates to
            :func:`simulator.logic.get_average_utilized_cpu`.
        """
        return logic.get_average_utilized_cpu()

    def get_used_memory(self) -> int:
        """Return the current simulated used memory in bytes.

        Returns:
            Number of bytes currently in use. The base implementation
            delegates to :func:`simulator.logic.get_average_utilized_ram`
            using :meth:`get_total_memory` as the capacity.
        """
        return logic.get_average_utilized_ram(self.get_total_memory())

    def get_total_memory(self) -> int:
        """Return the total installed memory in bytes.

        Returns:
            Total memory capacity in bytes. Default is ``762551372`` (~728 MB).
            Subclasses may override to simulate different hardware.
        """
        return 762551372

    def get_interfaces(self) -> list[dict[str, Any]]:
        """Return interface definitions with updated traffic counters.

        For each interface in :attr:`interfaces_list`, increments
        ``in-octets`` and ``out-octets`` when ``admin-status`` is ``up`` and
        ``speed`` is greater than zero. Interfaces with ``if-index`` in
        ``range(20, 31)`` use higher utilization growth rates.

        Returns:
            List of interface dicts, each containing:

            * ``name`` (str): Interface name.
            * ``type`` (str): IANA or vendor interface type.
            * ``admin-status`` (str): ``up`` or ``down``.
            * ``oper-status`` (str): Mirrors ``admin-status``.
            * ``if-index`` (int): SNMP interface index.
            * ``phys-address`` (str): MAC address.
            * ``speed`` (str): Link speed in bits per second.
            * ``in-octets`` (str): Cumulative inbound byte counter.
            * ``out-octets`` (str): Cumulative outbound byte counter.

        Note:
            Counters are persisted in :attr:`interface_counters` between calls.
        """
        updated_interfaces = []
        for iface in self.interfaces_list:
            name = iface["name"]
            speed = int(iface["speed"])
            status = iface["admin-status"]

            prev_in = self.interface_counters.get(f"{name}_in", 0)
            prev_out = self.interface_counters.get(f"{name}_out", 0)

            # Omit inactive ports from counter updates
            if status == "up" and speed > 0:
                # Consider ports in range 20 to 30 as higher utilized IN ones
                if iface["if-index"] not in range(20, 31):
                    new_in = logic.increase_interface_counter(
                        prev_in, speed, f"{self.hostname}_{name}_in"
                    )
                    new_out = logic.increase_interface_counter(
                        prev_out, speed * 0.7, f"{self.hostname}_{name}_out"
                    )
                else:
                    new_in = logic.increase_interface_counter_for_higher_utilized(
                        prev_in, speed, f"{self.hostname}_{name}_in"
                    )
                    new_out = logic.increase_interface_counter_for_higher_utilized(
                        prev_out, speed * 0.05, f"{self.hostname}_{name}_out"
                    )
            else:
                new_in = prev_in
                new_out = prev_out

            self.interface_counters[f"{name}_in"] = new_in
            self.interface_counters[f"{name}_out"] = new_out

            updated_interfaces.append(
                {
                    "name": name,
                    "type": iface["type"],
                    "admin-status": status,
                    "oper-status": status,
                    "if-index": iface["if-index"],
                    "phys-address": iface["phys-address"],
                    "speed": str(speed),
                    "in-octets": str(new_in),
                    "out-octets": str(new_out),
                }
            )

        return updated_interfaces


# Cisco devices
class BaseCiscoDevice(BaseDevice):
    """Base Cisco device simulating RESTCONF-compatible IOS XE responses.

    Populates :attr:`interfaces_list` with a default set of Cisco interfaces
    (VLAN, GigabitEthernet, Loopback). CPU and memory methods inherit average
    utilization behaviour from :class:`BaseDevice`.

    See Also:
        :mod:`simulator.main` for the RESTCONF endpoints that consume this
        device's metrics.
    """

    def __init__(
        self, ip_address: str, vendor: str, hostname: str, model: str, username: str, password: str, port: int, https: bool
    ) -> None:
        """Initialize a Cisco device with default interface definitions.

        Args:
            ip_address: Simulated management IP address.
            vendor: Expected to be ``cisco``.
            hostname: Device hostname.
            model: Hardware model string.
            username: HTTP Basic auth username.
            password: HTTP Basic auth password.
            port: Simulator listen port.
            https: HTTPS flag.
        """
        super().__init__(
            ip_address, vendor, hostname, model, username, password, port, https
        )

        # Define common interfaces for all Cisco devices
        self.interfaces_list = [
            {
                "name": "Vlan2",
                "type": "iana-if-type:propVirtual",
                "admin-status": "up",
                "if-index": 4,
                "phys-address": "00:50:56:bf:29:d2",
                "speed": "2000000000",
            },
            {
                "name": "GigabitEthernet1/0/2",
                "type": "iana-if-type:ethernetCsmacd",
                "admin-status": "up",
                "if-index": 21,
                "phys-address": "00:60:5a:bf:19:c4",
                "speed": "1000000000",
            },
            {
                "name": "GigabitEthernet2/0/4.14",
                "type": "iana-if-type:ethernetCsmacd",
                "admin-status": "down",
                "if-index": 7,
                "phys-address": "00:78:5a:ac:39:d2",
                "speed": "1000000000",
            },
            {
                "name": "Loopback1",
                "type": "iana-if-type:softwareLoopback",
                "admin-status": "up",
                "if-index": 11,
                "phys-address": "00:50:56:bf:29:d2",
                "speed": "0",
            },
        ]


class HighUtilizedCiscoDevice(BaseCiscoDevice):
    """Cisco device that reports persistently high CPU and memory utilization.

    CPU values are typically in the ``70``–``100`` range with occasional spikes
    to ``100``. Memory usage follows a high-utilization distribution.
    """

    def __init__(
        self, ip_address: str, vendor: str, hostname: str, model: str, username: str, password: str, port: int, https: bool
    ) -> None:
        """Initialize a high-utilization Cisco device.

        Args:
            ip_address: Simulated management IP address.
            vendor: Expected to be ``cisco``.
            hostname: Device hostname.
            model: Hardware model string.
            username: HTTP Basic auth username.
            password: HTTP Basic auth password.
            port: Simulator listen port.
            https: HTTPS flag.
        """
        super().__init__(
            ip_address, vendor, hostname, model, username, password, port, https
        )

    def get_cpu(self) -> int:
        """Return high CPU utilization percentage.

        Returns:
            Integer in the range ``0``–``100`` from
            :func:`simulator.logic.get_high_utilized_cpu`.
        """
        return logic.get_high_utilized_cpu()

    def get_used_memory(self) -> int:
        """Return high memory usage in bytes.

        Returns:
            Used memory bytes from
            :func:`simulator.logic.get_high_utilized_ram`.
        """
        return logic.get_high_utilized_ram(self.get_total_memory())


class LowUtilizedCiscoDevice(BaseCiscoDevice):
    """Cisco device that reports persistently low CPU and memory utilization.

    Total memory is halved compared to the base device to simulate smaller
    hardware.
    """

    def __init__(
        self, ip_address: str, vendor: str, hostname: str, model: str, username: str, password: str, port: int, https: bool
    ) -> None:
        """Initialize a low-utilization Cisco device.

        Args:
            ip_address: Simulated management IP address.
            vendor: Expected to be ``cisco``.
            hostname: Device hostname.
            model: Hardware model string.
            username: HTTP Basic auth username.
            password: HTTP Basic auth password.
            port: Simulator listen port.
            https: HTTPS flag.
        """
        super().__init__(
            ip_address, vendor, hostname, model, username, password, port, https
        )

    def get_cpu(self) -> int:
        """Return low CPU utilization percentage.

        Returns:
            Integer in the range ``0``–``100`` from
            :func:`simulator.logic.get_low_utilized_cpu`.
        """
        return logic.get_low_utilized_cpu()

    def get_used_memory(self) -> int:
        """Return low memory usage in bytes.

        Returns:
            Used memory bytes from
            :func:`simulator.logic.get_low_utilized_ram`.
        """
        return logic.get_low_utilized_ram(self.get_total_memory())

    def get_total_memory(self) -> int:
        """Return reduced total memory for a smaller Cisco device.

        Returns:
            ``381275686`` bytes (~364 MB), half of the base default.
        """
        return 381275686


class AverageUtilizedCiscoDevice(BaseCiscoDevice):
    """Cisco device with average CPU/memory and an extended interface list.

    Extends the base Cisco interfaces with additional GigabitEthernet and VLAN
    entries, including high-speed ports (8 Gbps and 10 Gbps).
    """

    def __init__(
        self, ip_address: str, vendor: str, hostname: str, model: str, username: str, password: str, port: int, https: bool
    ) -> None:
        """Initialize an average-utilization Cisco device.

        Args:
            ip_address: Simulated management IP address.
            vendor: Expected to be ``cisco``.
            hostname: Device hostname.
            model: Hardware model string.
            username: HTTP Basic auth username.
            password: HTTP Basic auth password.
            port: Simulator listen port.
            https: HTTPS flag.
        """
        super().__init__(
            ip_address, vendor, hostname, model, username, password, port, https
        )

        # Add additional interfaces to devices using this profile
        self.interfaces_list.extend(
            [
                {
                    "name": "GigabitEthernet1/0/3",
                    "type": "iana-if-type:ethernetCsmacd",
                    "admin-status": "down",
                    "if-index": 12,
                    "phys-address": "00:60:5a:bf:19:c5",
                    "speed": "2000000000",
                },
                {
                    "name": "Vlan10",
                    "type": "iana-if-type:propVirtual",
                    "admin-status": "up",
                    "if-index": 20,
                    "phys-address": "00:50:56:bf:29:18",
                    "speed": "1000000000",
                },
                {
                    "name": "GigabitEthernet1/0/5",
                    "type": "iana-if-type:ethernetCsmacd",
                    "admin-status": "up",
                    "if-index": 24,
                    "phys-address": "00:50:56:bf:29:d7",
                    "speed": "8000000000",
                },
                {
                    "name": "GigabitEthernet1/0/6",
                    "type": "iana-if-type:ethernetCsmacd",
                    "admin-status": "up",
                    "if-index": 13,
                    "phys-address": "00:50:56:bf:29:d8",
                    "speed": "10000000000",
                },
            ]
        )


# Juniper devices
class BaseJuniperDevice(BaseDevice):
    """Base Juniper device simulating Junos RPC-style responses.

    Populates :attr:`interfaces_list` with default Juniper interfaces
    (``ge-*``, ``em*``, ``lo0``). CPU and memory methods inherit average
    utilization behaviour from :class:`BaseDevice`.
    """

    def __init__(
        self, ip_address: str, vendor: str, hostname: str, model: str, username: str, password: str, port: int, https: bool
    ) -> None:
        """Initialize a Juniper device with default interface definitions.

        Args:
            ip_address: Simulated management IP address.
            vendor: Expected to be ``juniper``.
            hostname: Device hostname.
            model: Hardware model string.
            username: HTTP Basic auth username.
            password: HTTP Basic auth password.
            port: Simulator listen port.
            https: HTTPS flag.
        """
        super().__init__(
            ip_address, vendor, hostname, model, username, password, port, https
        )

        # Define common interfaces for all Juniper devices
        self.interfaces_list = [
            {
                "name": "ge-0/0/0",
                "type": "Ethernet",
                "admin-status": "down",
                "if-index": 3,
                "speed": "2000000000",
                "phys-address": "00:f3:85:32:ab:80",
            },
            {
                "name": "ge-0/0/1",
                "type": "Ethernet",
                "admin-status": "up",
                "if-index": 23,
                "speed": "4000000000",
                "phys-address": "00:6b:85:22:e4:01",
            },
            {
                "name": "em1",
                "type": "Ethernet",
                "admin-status": "up",
                "if-index": 12,
                "speed": "1000000000",
                "phys-address": "00:31:56:ac:4f:01",
            },
            {
                "name": "lo0",
                "type": "Loopback",
                "admin-status": "up",
                "if-index": 4,
                "speed": "0",
                "phys-address": "00:05:85:22:ab:01",
            },
        ]


class HighUtilizedJuniperDevice(BaseJuniperDevice):
    """Juniper device that reports persistently high CPU and memory utilization."""

    def __init__(
        self, ip_address: str, vendor: str, hostname: str, model: str, username: str, password: str, port: int, https: bool
    ) -> None:
        """Initialize a high-utilization Juniper device.

        Args:
            ip_address: Simulated management IP address.
            vendor: Expected to be ``juniper``.
            hostname: Device hostname.
            model: Hardware model string.
            username: HTTP Basic auth username.
            password: HTTP Basic auth password.
            port: Simulator listen port.
            https: HTTPS flag.
        """
        super().__init__(
            ip_address, vendor, hostname, model, username, password, port, https
        )

    def get_cpu(self) -> int:
        """Return high CPU utilization percentage.

        Returns:
            Integer in the range ``0``–``100`` from
            :func:`simulator.logic.get_high_utilized_cpu`.
        """
        return logic.get_high_utilized_cpu()

    def get_used_memory(self) -> int:
        """Return high memory usage in bytes.

        Returns:
            Used memory bytes from
            :func:`simulator.logic.get_high_utilized_ram`.
        """
        return logic.get_high_utilized_ram(self.get_total_memory())


class LowUtilizedJuniperDevice(BaseJuniperDevice):
    """Juniper device that reports persistently low CPU and memory utilization.

    Total memory is halved compared to the base device.
    """

    def __init__(
        self, ip_address: str, vendor: str, hostname: str, model: str, username: str, password: str, port: int, https: bool
    ) -> None:
        """Initialize a low-utilization Juniper device.

        Args:
            ip_address: Simulated management IP address.
            vendor: Expected to be ``juniper``.
            hostname: Device hostname.
            model: Hardware model string.
            username: HTTP Basic auth username.
            password: HTTP Basic auth password.
            port: Simulator listen port.
            https: HTTPS flag.
        """
        super().__init__(
            ip_address, vendor, hostname, model, username, password, port, https
        )

    def get_cpu(self) -> int:
        """Return low CPU utilization percentage.

        Returns:
            Integer in the range ``0``–``100`` from
            :func:`simulator.logic.get_low_utilized_cpu`.
        """
        return logic.get_low_utilized_cpu()

    def get_total_memory(self) -> int:
        """Return reduced total memory for a smaller Juniper device.

        Returns:
            Half of :meth:`BaseDevice.get_total_memory`, i.e. ``381275686``
            bytes.
        """
        return int(super().get_total_memory() / 2)

    def get_used_memory(self) -> int:
        """Return low memory usage in bytes.

        Returns:
            Used memory bytes from
            :func:`simulator.logic.get_low_utilized_ram`.
        """
        return logic.get_low_utilized_ram(self.get_total_memory())


class AverageUtilizedJuniperDevice(BaseJuniperDevice):
    """Juniper device with average CPU/memory and an extended interface list.

    Adds ``ge-2/0/0``, ``irb1``, and ``em2`` interfaces to the base set.
    """

    def __init__(
        self, ip_address: str, vendor: str, hostname: str, model: str, username: str, password: str, port: int, https: bool
    ) -> None:
        """Initialize an average-utilization Juniper device.

        Args:
            ip_address: Simulated management IP address.
            vendor: Expected to be ``juniper``.
            hostname: Device hostname.
            model: Hardware model string.
            username: HTTP Basic auth username.
            password: HTTP Basic auth password.
            port: Simulator listen port.
            https: HTTPS flag.
        """
        super().__init__(
            ip_address, vendor, hostname, model, username, password, port, https
        )

        # Extend interface list for device using this profile
        self.interfaces_list.extend(
            [
                {
                    "name": "ge-2/0/0",
                    "type": "Ethernet",
                    "admin-status": "up",
                    "if-index": 25,
                    "speed": "8000000000",
                    "phys-address": "00:a3:e5:72:12:70",
                },
                {
                    "name": "irb1",
                    "type": "VxLAN-Tunnel-Endpoint",
                    "admin-status": "up",
                    "if-index": 11,
                    "speed": "2000000000",
                    "phys-address": "00:65:a5:ee:4f:21",
                },
                {
                    "name": "em2",
                    "type": "Ethernet",
                    "admin-status": "up",
                    "if-index": 17,
                    "speed": "1000000000",
                    "phys-address": "00:a4:51:cf:7f:22",
                },
            ]
        )


class customUtilizedCiscoDevice(BaseCiscoDevice):
    """Cisco device with user-defined utilization via a :class:`CustomProfile`.

    Attributes:
        profile (CustomProfile): Utilization parameters controlling CPU and
            memory randomization. Defaults to a new :class:`CustomProfile`
            instance when not provided.
    """

    def __init__(
        self, 
        ip_address: str, 
        vendor: str, 
        hostname: str, 
        model: str, 
        username: str, 
        password: str, 
        port: int, 
        https: bool,
        profile: Optional[CustomProfile] = None
    ) -> None:
        """Initialize a custom-utilization Cisco device.

        Args:
            ip_address: Simulated management IP address.
            vendor: Expected to be ``cisco``.
            hostname: Device hostname.
            model: Hardware model string.
            username: HTTP Basic auth username.
            password: HTTP Basic auth password.
            port: Simulator listen port.
            https: HTTPS flag.
            profile: Custom utilization profile. When ``None``, a default
                :class:`~simulator.logic.CustomProfile` is created.

        Raises:
            pydantic.ValidationError: If ``profile`` contains invalid field
                values (e.g. spike + drop chance exceeding 100%).
        """
        super().__init__(
            ip_address, vendor, hostname, model, username, password, port, https
        )

        self.profile = profile or CustomProfile()

    def get_cpu(self) -> int:
        """Return CPU utilization based on :attr:`profile`.

        Returns:
            Integer in the range ``0``–``100`` from
            :func:`simulator.logic.get_custom_utilized_cpu`.
        """
        return logic.get_custom_utilized_cpu(self.profile)

    def get_used_memory(self) -> int:
        """Return memory usage based on :attr:`profile`.

        Returns:
            Used memory bytes from
            :func:`simulator.logic.get_custom_utilized_ram`.
        """
        return logic.get_custom_utilized_ram(self.get_total_memory(), self.profile)
    

class customUtilizedJuniperDevice(BaseJuniperDevice):
    """Juniper device with user-defined utilization via a :class:`CustomProfile`.

    Attributes:
        profile (CustomProfile): Utilization parameters controlling CPU and
            memory randomization. Defaults to a new :class:`CustomProfile`
            instance when not provided.
    """

    def __init__(
        self, 
        ip_address: str, 
        vendor: str, 
        hostname: str, 
        model: str, 
        username: str, 
        password: str, 
        port: int, 
        https: bool,
        profile: Optional[CustomProfile] = None
    ) -> None:
        """Initialize a custom-utilization Juniper device.

        Args:
            ip_address: Simulated management IP address.
            vendor: Expected to be ``juniper``.
            hostname: Device hostname.
            model: Hardware model string.
            username: HTTP Basic auth username.
            password: HTTP Basic auth password.
            port: Simulator listen port.
            https: HTTPS flag.
            profile: Custom utilization profile. When ``None``, a default
                :class:`~simulator.logic.CustomProfile` is created.

        Raises:
            pydantic.ValidationError: If ``profile`` contains invalid field
                values (e.g. spike + drop chance exceeding 100%).
        """
        super().__init__(
            ip_address, vendor, hostname, model, username, password, port, https
        )

        self.profile = profile or CustomProfile()

    def get_cpu(self) -> int:
        """Return CPU utilization based on :attr:`profile`.

        Returns:
            Integer in the range ``0``–``100`` from
            :func:`simulator.logic.get_custom_utilized_cpu`.
        """
        return logic.get_custom_utilized_cpu(self.profile)

    def get_used_memory(self) -> int:
        """Return memory usage based on :attr:`profile`.

        Returns:
            Used memory bytes from
            :func:`simulator.logic.get_custom_utilized_ram`.
        """
        return logic.get_custom_utilized_ram(self.get_total_memory(), self.profile)
