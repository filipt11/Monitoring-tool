package app.services;

import app.dtos.device.DeviceCreateDto;
import app.dtos.device.DeviceInterfaceResponse;
import app.dtos.device.DeviceNoCredentialsResponse;
import app.dtos.device.DeviceResponse;
import app.dtos.device.DeviceUpdateDto;
import app.exceptions.DeviceNotFoundException;
import app.mappers.DeviceInterfaceMapper;
import app.mappers.DeviceMapper;
import app.records.MessageResponse;
import app.repositories.DeviceGroupRepository;
import app.repositories.DeviceInterfaceRepository;
import app.repositories.DeviceRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.util.List;


@Service
public class DeviceService {
    private final DeviceRepository deviceRepository;
    private final DeviceInterfaceRepository deviceInterfaceRepository;
    private final DeviceGroupRepository deviceGroupRepository;
    private final DeviceMapper deviceMapper;
    private final DeviceInterfaceMapper deviceInterfaceMapper;
    private final RestClient deviceRestClient;

    public DeviceService(
            DeviceRepository deviceRepository,
            DeviceInterfaceRepository deviceInterfaceRepository,
            DeviceGroupRepository deviceGroupRepository,
            DeviceMapper deviceMapper,
            DeviceInterfaceMapper deviceInterfaceMapper,
            RestClient deviceRestClient
    ) {
        this.deviceRepository = deviceRepository;
        this.deviceInterfaceRepository = deviceInterfaceRepository;
        this.deviceGroupRepository = deviceGroupRepository;
        this.deviceMapper = deviceMapper;
        this.deviceInterfaceMapper = deviceInterfaceMapper;
        this.deviceRestClient = deviceRestClient;
    }

    public Page<DeviceNoCredentialsResponse> getAllDevices(Pageable pageable) {
        return deviceRepository.findAll(pageable)
                .map(deviceMapper::toNoCredentialsDto);
    }

    public DeviceResponse getDeviceById(Long id) {
        return deviceRepository.findById(id)
                .map(deviceMapper::toResponseDto)
                .orElseThrow(() -> new DeviceNotFoundException());
    }

    public List<DeviceInterfaceResponse> getDeviceInterfaces(Long deviceId) {
        if (!deviceRepository.existsById(deviceId)) {
            throw new DeviceNotFoundException();
        }

        return deviceInterfaceMapper.toResponseDtoList(
                deviceInterfaceRepository.findByDeviceIdOrderByIfIndexAsc(deviceId)
        );
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
    @Transactional
    public MessageResponse deleteDevice(Long id) {
        deviceGroupRepository.removeDeviceFromAllGroups(id);

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

    // Use poller API to rediscover device in database
    public DeviceResponse rediscoverDevice(Long id) {
        return deviceRestClient.post()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/rediscover/{id}")
                        .build(id))
                .retrieve()
                .body(DeviceResponse.class);
    }
}
