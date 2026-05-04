import logic


class BaseDevice:
    """Class representing base device model"""

    def __init__(
        self, ip_address, vendor, hostname, model, username, password, port, https
    ):
        self.ip_address = ip_address
        self.vendor = vendor
        self.hostname = hostname
        self.model = model
        self.username = username
        self.password = password
        self.port = port
        self.https = https
        self.interface_counters = {}
        self.interfaces_list = []

    def __repr__(self):
        return f"<BaseDevice {self.hostname} ({self.ip_address}) - {self.vendor} {self.model}>"

    def get_cpu(self) -> int:
        """Return raw device CPU usage value."""

        return logic.get_average_utilized_cpu()

    def get_used_memory(self) -> int:
        """Return raw device Memory usage value."""

        return logic.get_average_utilized_ram(self.get_total_memory())

    def get_total_memory(self) -> int:
        """Return device total memory
        Base value can be overridden in subclasses."""

        return 762551372

    def get_interfaces(self) -> list:
        updated_interfaces = []
        for iface in self.interfaces_list:
            name = iface["name"]
            speed = int(iface["speed"])
            status = iface["admin-status"]

            prev_in = self.interface_counters.get(f"{name}_in", 0)
            prev_out = self.interface_counters.get(f"{name}_out", 0)

            # Omitt inactive ports
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
    """Class representing base Cisco device model
    Simulating data compliant with RESTCONF protocol format using by Cisco IOS XE devices
    By default methods return data as for average utilized device."""

    def __init__(
        self, ip_address, vendor, hostname, model, username, password, port, https
    ):
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
    """Class representing higher utilized Cisco device
    Methods regarding CPU and Memory usage generate higher values."""

    def __init__(
        self, ip_address, vendor, hostname, model, username, password, port, https
    ):
        super().__init__(
            ip_address, vendor, hostname, model, username, password, port, https
        )

    def get_cpu(self) -> int:
        """Override base class method to return higher CPU usage values."""

        return logic.get_high_utilized_cpu()

    def get_used_memory(self) -> int:
        """Override base class method to return higher Memory usage values."""

        return logic.get_high_utilized_ram(self.get_total_memory())


class LowUtilizedCiscoDevice(BaseCiscoDevice):
    """Class representing lower utilized Cisco device
    Methods regarding CPU and Memory usage generate lower values."""

    def __init__(
        self, ip_address, vendor, hostname, model, username, password, port, https
    ):
        super().__init__(
            ip_address, vendor, hostname, model, username, password, port, https
        )

    def get_cpu(self) -> int:
        """Override base class method to return lower CPU usage values."""

        return logic.get_low_utilized_cpu()

    def get_used_memory(self) -> int:
        """Override base class method to return lower Memory usage values."""

        return logic.get_low_utilized_ram(self.get_total_memory())

    def get_total_memory(self) -> int:
        """Override base class method to simulate lower total memory for device."""

        return 381275686


class AverageUtilizedCiscoDevice(BaseCiscoDevice):
    """Class representaing average utilized Cisco device, extended for a few more interfaces."""

    def __init__(
        self, ip_address, vendor, hostname, model, username, password, port, https
    ):
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
    def __init__(
        self, ip_address, vendor, hostname, model, username, password, port, https
    ):
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
    def __init__(
        self, ip_address, vendor, hostname, model, username, password, port, https
    ):
        super().__init__(
            ip_address, vendor, hostname, model, username, password, port, https
        )

    def get_cpu(self) -> int:
        return logic.get_high_utilized_cpu()

    def get_used_memory(self) -> int:
        return logic.get_high_utilized_ram(self.get_total_memory())


class LowUtilizedJuniperDevice(BaseJuniperDevice):
    def __init__(
        self, ip_address, vendor, hostname, model, username, password, port, https
    ):
        super().__init__(
            ip_address, vendor, hostname, model, username, password, port, https
        )

    def get_cpu(self) -> int:
        return logic.get_low_utilized_cpu()

    def get_total_memory(self) -> int:
        """Cut total memory by half for lower utilized device"""
        return int(super().get_total_memory() / 2)

    def get_used_memory(self) -> int:
        return logic.get_low_utilized_ram(self.get_total_memory())


class AverageUtilizedJuniperDevice(BaseJuniperDevice):
    def __init__(
        self, ip_address, vendor, hostname, model, username, password, port, https
    ):
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
