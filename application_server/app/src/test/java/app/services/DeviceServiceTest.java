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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceServiceTest {

    @Mock
    private DeviceRepository deviceRepository;

    @Mock
    private DeviceInterfaceRepository deviceInterfaceRepository;

    @Mock
    private DeviceGroupRepository deviceGroupRepository;

    @Mock
    private DeviceMapper deviceMapper;

    @Mock
    private DeviceInterfaceMapper deviceInterfaceMapper;

    @Mock
    private RestClient deviceRestClient;

    @Mock
    private RestClient.RequestBodyUriSpec requestBodyUriSpec;

    @Mock
    private RestClient.RequestHeadersUriSpec requestHeadersUriSpec;

    @Mock
    private RestClient.ResponseSpec responseSpec;

    @InjectMocks
    private DeviceService deviceService;

    private DeviceResponse deviceResponse;
    private DeviceNoCredentialsResponse deviceNoCredentialsResponse;

    @BeforeEach
    void setUp() {
        deviceResponse = new DeviceResponse(
                1L, "192.168.1.1", "router1", "Cisco", "9000",
                "admin", "pass", 443, false, Instant.parse("2026-01-01T00:00:00Z")
        );
        deviceNoCredentialsResponse = new DeviceNoCredentialsResponse(
                1L, "192.168.1.1", "router1", "Cisco", "9000", 443, false
        );
    }

    @Test
    void getAllDevices_shouldReturnMappedPage() {
        Pageable pageable = PageRequest.of(0, 10);
        app.entities.Device device = deviceEntity(1L);
        Page<app.entities.Device> page = new PageImpl<>(List.of(device), pageable, 1);

        when(deviceRepository.findAll(pageable)).thenReturn(page);
        when(deviceMapper.toNoCredentialsDto(device)).thenReturn(deviceNoCredentialsResponse);

        Page<DeviceNoCredentialsResponse> result = deviceService.getAllDevices(pageable);

        assertThat(result.getContent()).containsExactly(deviceNoCredentialsResponse);
    }

    @Test
    void getDeviceById_shouldReturnDevice_whenDeviceExists() {
        app.entities.Device device = deviceEntity(1L);

        when(deviceRepository.findById(1L)).thenReturn(Optional.of(device));
        when(deviceMapper.toResponseDto(device)).thenReturn(deviceResponse);

        DeviceResponse result = deviceService.getDeviceById(1L);

        assertThat(result).isEqualTo(deviceResponse);
    }

    @Test
    void getDeviceById_shouldThrowDeviceNotFoundException_whenDeviceDoesNotExist() {
        when(deviceRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> deviceService.getDeviceById(99L))
                .isInstanceOf(DeviceNotFoundException.class);
    }

    @Test
    void getDeviceInterfaces_shouldReturnInterfaces_whenDeviceExists() {
        app.entities.DeviceInterface deviceInterface = deviceInterfaceEntity(10L);
        DeviceInterfaceResponse interfaceResponse = new DeviceInterfaceResponse(
                10L, 1L, "eth0", 1, "mac", 1000L, "up", "up", Instant.now()
        );

        when(deviceRepository.existsById(1L)).thenReturn(true);
        when(deviceInterfaceRepository.findByDeviceIdOrderByIfIndexAsc(1L)).thenReturn(List.of(deviceInterface));
        when(deviceInterfaceMapper.toResponseDtoList(List.of(deviceInterface))).thenReturn(List.of(interfaceResponse));

        List<DeviceInterfaceResponse> result = deviceService.getDeviceInterfaces(1L);

        assertThat(result).containsExactly(interfaceResponse);
    }

    @Test
    void getDeviceInterfaces_shouldThrowDeviceNotFoundException_whenDeviceDoesNotExist() {
        when(deviceRepository.existsById(99L)).thenReturn(false);

        assertThatThrownBy(() -> deviceService.getDeviceInterfaces(99L))
                .isInstanceOf(DeviceNotFoundException.class);
    }

    @Test
    void searchDevicesByName_shouldReturnMatchingDevices() {
        Pageable pageable = PageRequest.of(0, 10);
        app.entities.Device device = deviceEntity(1L);
        Page<app.entities.Device> page = new PageImpl<>(List.of(device), pageable, 1);

        when(deviceRepository.findByHostnameStartingWithIgnoreCase(pageable, "router"))
                .thenReturn(page);
        when(deviceMapper.toNoCredentialsDto(device)).thenReturn(deviceNoCredentialsResponse);

        Page<DeviceNoCredentialsResponse> result = deviceService.searchDevicesByName(pageable, "router");

        assertThat(result.getContent()).containsExactly(deviceNoCredentialsResponse);
    }

    @Test
    void searchDevicesByIp_shouldReturnMatchingDevices() {
        Pageable pageable = PageRequest.of(0, 10);
        app.entities.Device device = deviceEntity(1L);
        Page<app.entities.Device> page = new PageImpl<>(List.of(device), pageable, 1);

        when(deviceRepository.findByIpStartingWithIgnoreCase(pageable, "192.168"))
                .thenReturn(page);
        when(deviceMapper.toNoCredentialsDto(device)).thenReturn(deviceNoCredentialsResponse);

        Page<DeviceNoCredentialsResponse> result = deviceService.searchDevicesByIp(pageable, "192.168");

        assertThat(result.getContent()).containsExactly(deviceNoCredentialsResponse);
    }

    @Test
    void addDevice_shouldCallPollerApiAndReturnResponse() {
        DeviceCreateDto dto = new DeviceCreateDto("192.168.1.1", "cisco", "admin", "pass", 443, true);
        mockPostWithBody(deviceResponse);

        DeviceResponse result = deviceService.addDevice(dto);

        assertThat(result).isEqualTo(deviceResponse);
        verify(deviceRestClient).post();
        verify(requestBodyUriSpec).body(dto);
    }

    @Test
    void deleteDevice_shouldRemoveFromGroupsAndCallPollerApi() {
        MessageResponse messageResponse = new MessageResponse("Device deleted");
        mockDeleteResponse(messageResponse);

        MessageResponse result = deviceService.deleteDevice(1L);

        assertThat(result).isEqualTo(messageResponse);
        verify(deviceGroupRepository).removeDeviceFromAllGroups(1L);
        verify(deviceRestClient).delete();
    }

    @Test
    void updateDevice_shouldCallPollerApiAndReturnResponse() {
        DeviceUpdateDto dto = new DeviceUpdateDto(443, true, "admin", "newpass");
        mockPatchWithBody(deviceResponse);

        DeviceResponse result = deviceService.updateDevice(1L, dto);

        assertThat(result).isEqualTo(deviceResponse);
        verify(deviceRestClient).patch();
        verify(requestBodyUriSpec).body(dto);
    }

    @Test
    void rediscoverDevice_shouldCallPollerApiAndReturnResponse() {
        mockPostWithoutBody(deviceResponse);

        DeviceResponse result = deviceService.rediscoverDevice(1L);

        assertThat(result).isEqualTo(deviceResponse);
        verify(deviceRestClient).post();
    }

    private void mockPostWithBody(DeviceResponse response) {
        when(deviceRestClient.post()).thenReturn(requestBodyUriSpec);
        when(requestBodyUriSpec.uri(any(Function.class))).thenReturn(requestBodyUriSpec);
        when(requestBodyUriSpec.body(any(Object.class))).thenReturn(requestBodyUriSpec);
        when(requestBodyUriSpec.retrieve()).thenReturn(responseSpec);
        doReturn(response).when(responseSpec).body(DeviceResponse.class);
    }

    private void mockPostWithoutBody(DeviceResponse response) {
        when(deviceRestClient.post()).thenReturn(requestBodyUriSpec);
        when(requestBodyUriSpec.uri(any(Function.class))).thenReturn(requestBodyUriSpec);
        when(requestBodyUriSpec.retrieve()).thenReturn(responseSpec);
        doReturn(response).when(responseSpec).body(DeviceResponse.class);
    }

    private void mockPatchWithBody(DeviceResponse response) {
        when(deviceRestClient.patch()).thenReturn(requestBodyUriSpec);
        when(requestBodyUriSpec.uri(any(Function.class))).thenReturn(requestBodyUriSpec);
        when(requestBodyUriSpec.body(any(Object.class))).thenReturn(requestBodyUriSpec);
        when(requestBodyUriSpec.retrieve()).thenReturn(responseSpec);
        doReturn(response).when(responseSpec).body(DeviceResponse.class);
    }

    private void mockDeleteResponse(MessageResponse response) {
        when(deviceRestClient.delete()).thenReturn(requestHeadersUriSpec);
        when(requestHeadersUriSpec.uri(any(Function.class))).thenReturn(requestHeadersUriSpec);
        when(requestHeadersUriSpec.retrieve()).thenReturn(responseSpec);
        doReturn(response).when(responseSpec).body(MessageResponse.class);
    }

    private app.entities.Device deviceEntity(Long id) {
        return new app.entities.Device(
                id, "192.168.1.1", "router1", "Cisco", "9000",
                "admin", "pass", 443, false, Instant.now(), null, null
        );
    }

    private app.entities.DeviceInterface deviceInterfaceEntity(Long id) {
        return new app.entities.DeviceInterface(
                id, 1L, "eth0", 1, "mac", 1000L, "up", "up", Instant.now()
        );
    }
}
