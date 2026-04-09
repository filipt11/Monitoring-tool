import random

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
    
    def __str__(self):
        return f"""        IP: {self.ip_address}
        Vendor: {self.vendor}
        Hostname: {self.hostname}
        model Address: {self.model}"""
        
    def get_total_memory(self):
        return 762551372     
    
        
class HighUtilizedDevice(BaseDevice):
    def __init__(self, ip_address, vendor, hostname, model, username, password, port, https):
        super().__init__(ip_address, vendor, hostname, model, username, password, port, https)
    
    def get_cpu(self):
        return random.randint(0,100)
    
    def get_used_memory(self):
        return random.randint(426511972, 556511972)
    
    def get_interfaces(self):
        return ["If1", "Vlan2"]
    

class LowUtilizedDevice(BaseDevice):
    def __init__(self, ip_address, vendor, hostname, model, username, password, port, https):
        super().__init__(ip_address, vendor, hostname, model, username, password, port, https)
    
    def get_cpu(self):
        return random.randint(0,100)
    
    def get_used_memory(self):
        return random.randint(226511972, 316511972)
    
    def get_interfaces(self):
        return ["If1", "Vlan2"]
    

class RandomUtilizedDevice(BaseDevice):
    def __init__(self, ip_address, vendor, hostname, model, username, password, port, https):
        super().__init__(ip_address, vendor, hostname, model, username, password, port, https)
    
    def get_cpu(self):
        return random.randint(0,100)
    
    def get_used_memory(self):
        return random.randint(306511972, 356511972)
    
    def get_interfaces(self):
        return [{"name" : "Vlan2",
                 "type" : "iana-if-type:propVirtual",
                 "admin-status" : "up",
                 "oper-status" : "up",
                 "if-index": 4,
                 "phys-address": "00:50:56:bf:29:d2",
                 "speed": "8000000000",
                 "in-octets" : "4431",
                 "out-octets" : "2231"
                 }
                ,{"name" : "GigabitEthernet1/0/2",
                 "type" : "iana-if-type:ethernetCsmacd",
                 "admin-status" : "up",
                 "oper-status" : "up",
                 "if-index": 6,
                 "phys-address": "00:60:5a:bf:19:c4",
                 "speed": "8000000000",
                 "in-octets" : "4431",
                 "out-octets" : "2231"
                 },
                {"name" : "GigabitEthernet2/0/4.14",
                 "type" : "iana-if-type:ethernetCsmacd",
                 "admin-status" : "up",
                 "oper-status" : "up",
                 "if-index": 7,
                 "phys-address": "00:78:5a:ac:39:d2",
                 "speed": "1000000000",
                 "in-octets" : "4431",
                 "out-octets" : "2231"
                 },
                 {"name" : "Loopback1",
                 "type" : "iana-if-type:ethernetCsmacd",
                 "admin-status" : "up",
                 "oper-status" : "up",
                 "if-index": 11,
                 "phys-address": "00:80:5f:a4:19:e4",
                 "speed": "0",
                 "in-octets" : "0",
                 "out-octets" : "0"
                 },
                 {"name" : "GigabitEthernet1/0/2",
                 "type" : "iana-if-type:ethernetCsmacd",
                 "admin-status" : "down",
                 "oper-status" : "down",
                 "if-index": 24,
                 "phys-address": "00:60:5a:bf:19:c4",
                 "speed": "2000000000",
                 "in-octets" : "0",
                 "out-octets" : "0"
                 }]

