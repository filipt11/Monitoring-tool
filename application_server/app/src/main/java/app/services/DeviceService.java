package app.services;

import app.dtos.device.DeviceCreateDto;
import app.dtos.device.DeviceNoCredentialsResponse;
import app.dtos.device.DeviceResponse;
import app.dtos.device.DeviceUpdateDto;
import app.exceptions.DeviceNotFoundException;
import app.mappers.DeviceMapper;
import app.records.MessageResponse;
import app.repositories.DeviceRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;


@Service
public class DeviceService {
    private final DeviceRepository deviceRepository;
    private final DeviceMapper deviceMapper;
    private final RestClient deviceRestClient;

    public DeviceService(DeviceRepository deviceRepository, DeviceMapper deviceMapper, RestClient deviceRestClient) {
        this.deviceRepository = deviceRepository;
        this.deviceMapper = deviceMapper;
        this.deviceRestClient = deviceRestClient;
    }

    public Page<DeviceNoCredentialsResponse> getAllDevices(Pageable pageable) {
        return deviceRepository.findAll(pageable)
                .map(deviceMapper::toNoCredentialsDto);
    }

    public DeviceNoCredentialsResponse getDeviceById(Long id) {
        return deviceRepository.findById(id)
                .map(deviceMapper::toNoCredentialsDto)
                .orElseThrow(() -> new DeviceNotFoundException());
    }

    public Page<DeviceNoCredentialsResponse> searchDevicesByName(Pageable pageable, String hostname) {
        return deviceRepository.findByHostnameStartingWithIgnoreCase(pageable, hostname)
                .map(deviceMapper::toNoCredentialsDto);
    }

    public Page<DeviceNoCredentialsResponse> searchDevicesByIp(Pageable pageable, String ip) {
        return deviceRepository.findByIpStartingWithIgnoreCase(pageable, ip)
                .map(deviceMapper::toNoCredentialsDto);
    }

    // Use poller API to add device to database
    public DeviceResponse addDevice(DeviceCreateDto dto) {
        return deviceRestClient.post()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/device")
                        .build())
                .body(dto)
                .retrieve()
                .body(DeviceResponse.class);
    }

    // Use poller API to delete device from database
    public MessageResponse deleteDevice(Long id) {
        return deviceRestClient.delete()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/device/{id}")
                        .build(id))
                .retrieve()
                .body(MessageResponse.class);
    }

    // Use poller API to update device in database
    public DeviceResponse updateDevice(Long id, DeviceUpdateDto dto) {
        return deviceRestClient.patch()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/device/{id}")
                        .build(id))
                .body(dto)
                .retrieve()
                .body(DeviceResponse.class);
    }

}
