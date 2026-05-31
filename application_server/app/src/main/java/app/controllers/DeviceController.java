package app.controllers;

import app.dtos.device.DeviceCreateDto;
import app.dtos.device.DeviceNoCredentialsResponse;
import app.dtos.device.DeviceResponse;
import app.dtos.device.DeviceUpdateDto;
import app.records.MessageResponse;
import app.services.DeviceService;
import jakarta.validation.Valid;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import static org.springframework.http.HttpStatus.CREATED;

@RestController
public class DeviceController {
    private final DeviceService deviceService;

    public DeviceController(DeviceService deviceService) {
        this.deviceService = deviceService;
    }

    @GetMapping("/api/devices")
    public ResponseEntity<Page<DeviceNoCredentialsResponse>> getAllDevices(@ParameterObject Pageable pageable) {
        return ResponseEntity.ok(deviceService.getAllDevices(pageable));
    }

    @GetMapping("/api/devices/{id}")
    public ResponseEntity<DeviceNoCredentialsResponse> getDeviceById(@PathVariable Long id) {
        return ResponseEntity.ok(deviceService.getDeviceById(id));
    }

    @GetMapping("/api/devices/search/hostname")
    public ResponseEntity<Page<DeviceNoCredentialsResponse>> searchDevicesByName(@ParameterObject Pageable pageable, @RequestParam String name) {
        return ResponseEntity.ok(deviceService.searchDevicesByName(pageable, name));
    }

    @GetMapping("/api/devices/search/ip")
    public ResponseEntity<Page<DeviceNoCredentialsResponse>> searchDevicesByIp(@ParameterObject Pageable pageable, @RequestParam String ip) {
        return ResponseEntity.ok(deviceService.searchDevicesByIp(pageable, ip));
    }

    @PostMapping("/api/devices")
    public ResponseEntity<DeviceResponse> addDevice(@RequestBody @Valid DeviceCreateDto dto) {
        return ResponseEntity.status(CREATED).body(deviceService.addDevice(dto));
    }

    @DeleteMapping("/api/devices/{id}")
    public ResponseEntity<MessageResponse> deleteDevice(@PathVariable Long id) {
        return ResponseEntity.ok(deviceService.deleteDevice(id));
    }

    @PatchMapping("/api/devices/{id}")
    public ResponseEntity<DeviceResponse> updateDevice(@PathVariable Long id, @RequestBody @Valid DeviceUpdateDto dto) {
        return ResponseEntity.ok(deviceService.updateDevice(id, dto));
    }

    @PostMapping("/api/devices/rediscover/{id}")
    public ResponseEntity<DeviceResponse> rediscoverDevice(@PathVariable Long id) {
        return ResponseEntity.ok(deviceService.rediscoverDevice(id));
    }
}
