import logic

class BaseDevice:
    def __init__(self, ip_address, vendor, hostname, model, username, password, port, https):
        self.ip_address = ip_address
        self.vendor = vendor
        self.hostname = hostname
        self.model = model
        self.username = username
        self.password = password
        self.port = port
        self.https = https
        self.interface_counters = {}
        
        # Define common interfaces for all devices
        self.interfaces_list = [
            {
                "name": "Vlan2",
                "type": "iana-if-type:propVirtual",
                "admin-status": "up",
                "if-index": 4,
                "phys-address": "00:50:56:bf:29:d2",
                "speed": "2000000000"
            },
            {
                "name": "GigabitEthernet1/0/2",
                "type": "iana-if-type:ethernetCsmacd",
                "admin-status": "up",
                "if-index": 21,
                "phys-address": "00:60:5a:bf:19:c4",
                "speed": "1000000000"
            },
            {
                "name": "GigabitEthernet2/0/4.14",
                "type": "iana-if-type:ethernetCsmacd",
                "admin-status": "down",
                "if-index": 7,
                "phys-address": "00:78:5a:ac:39:d2",
                "speed": "1000000000"
            },
            {
                "name": "Loopback1",
                "type": "iana-if-type:softwareLoopback",
                "admin-status": "up",
                "if-index": 11,
                "phys-address": "00:50:56:bf:29:d2",
                "speed": "0"
            }
        ]        
    
    def __str__(self):
        return f"""        IP: {self.ip_address}
        Vendor: {self.vendor}
        Hostname: {self.hostname}
        model Address: {self.model}"""
        
    def get_total_memory(self):
        return 762551372
    
    def get_interfaces(self):
        """Return list of device interfaces with updated counters value"""
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
                    new_in = logic.increase_interface_counter(prev_in, speed)
                    new_out = logic.increase_interface_counter(prev_out, speed * 0.7)
                else:
                    new_in = logic.increase_interface_counter_for_higher_utilized(prev_in, speed)
                    new_out = logic.increase_interface_counter_for_higher_utilized(prev_out, speed * 0.05)
            else:
                new_in = prev_in
                new_out = prev_out
                
            self.interface_counters[f"{name}_in"] = new_in
            self.interface_counters[f"{name}_out"] = new_out
            
            updated_interfaces.append({
                "name": name,
                "type": iface["type"],
                "admin-status": status,
                "oper-status": status,
                "if-index": iface["if-index"],
                "phys-address": iface["phys-address"],
                "speed": str(speed),
                "in-octets": str(new_in),
                "out-octets": str(new_out)
            })
            
        return updated_interfaces         
    
        
class HighUtilizedDevice(BaseDevice):
    def __init__(self, ip_address, vendor, hostname, model, username, password, port, https):
        super().__init__(ip_address, vendor, hostname, model, username, password, port, https)
            
    def get_cpu(self):
        return logic.get_high_utilized_cpu()
    
    def get_used_memory(self):
        return logic.get_high_utilized_ram(self.get_total_memory())
    

class LowUtilizedDevice(BaseDevice):
    def __init__(self, ip_address, vendor, hostname, model, username, password, port, https):
        super().__init__(ip_address, vendor, hostname, model, username, password, port, https)
            
    def get_cpu(self):
        return logic.get_low_utilized_cpu()
    
    def get_used_memory(self):
        return logic.get_low_utilized_ram(self.get_total_memory())
    
    def get_total_memory(self):
        """Override base class method to simulate lower total memory for device"""
        return 381275686
    

class AverageUtilizedDevice(BaseDevice):
    def __init__(self, ip_address, vendor, hostname, model, username, password, port, https):
        super().__init__(ip_address, vendor, hostname, model, username, password, port, https)
        
        # Add additional interfaces to devices using this profile
        self.interfaces_list.extend([
            {
                "name": "GigabitEthernet1/0/3",
                "type": "iana-if-type:ethernetCsmacd",
                "admin-status": "down",
                "if-index": 12,
                "phys-address": "00:60:5a:bf:19:c5",
                "speed": "2000000000"
            },
            {   "name": "Vlan10",
                "type": "iana-if-type:propVirtual",
                "admin-status": "up",
                "if-index": 20,
                "phys-address": "00:50:56:bf:29:18",
                "speed": "1000000000"
            },
            {
                "name": "GigabitEthernet1/0/5",
                "type": "iana-if-type:ethernetCsmacd",
                "admin-status": "up",
                "if-index": 24,
                "phys-address": "00:50:56:bf:29:d7",
                "speed": "8000000000"
            },
            {
                "name": "GigabitEthernet1/0/6",
                "type": "iana-if-type:ethernetCsmacd",
                "admin-status": "up",
                "if-index": 13,
                "phys-address": "00:50:56:bf:29:d8",
                "speed": "10000000000"
            }
        ])
        
    def get_cpu(self):
        return logic.get_average_utilized_cpu()
    
    def get_used_memory(self):
        return logic.get_average_utilized_ram(self.get_total_memory())
    

