package app.services;

import app.dtos.dashboardSection.DashboardSectionCreateDto;
import app.dtos.dashboardSection.DashboardSectionCreateResponseDto;
import app.dtos.dashboardSection.DashboardSectionDetailResponseDto;
import app.dtos.dashboardSection.DashboardSectionOrderDto;
import app.dtos.dashboardSection.DashboardSectionResponseDto;
import app.entities.Dashboard;
import app.entities.DashboardSection;
import app.entities.DashboardSectionSourceType;
import app.entities.Device;
import app.entities.DeviceGroup;
import app.entities.DeviceInterface;
import app.entities.InterfaceGroup;
import app.exceptions.DashboardSectionNotFoundException;
import app.exceptions.DeviceGroupNotFoundException;
import app.exceptions.DeviceNotFoundException;
import app.exceptions.InterfaceGroupNotFoundException;
import app.exceptions.InterfaceNotFoundException;
import app.exceptions.InvalidRequestException;
import app.mappers.DashboardSectionMapper;
import app.records.MessageResponse;
import app.repositories.DashboardSectionRepository;
import app.repositories.DeviceGroupRepository;
import app.repositories.DeviceInterfaceRepository;
import app.repositories.DeviceRepository;
import app.repositories.InterfaceGroupRepository;
import app.security.SignedUserDetails;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.GrantedAuthority;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DashboardSectionServiceTest {

    @Mock
    private DashboardSectionRepository dashboardSectionRepository;

    @Mock
    private DashboardService dashboardService;

    @Mock
    private DeviceRepository deviceRepository;

    @Mock
    private DeviceGroupRepository deviceGroupRepository;

    @Mock
    private DeviceInterfaceRepository deviceInterfaceRepository;

    @Mock
    private InterfaceGroupRepository interfaceGroupRepository;

    @Mock
    private DashboardSectionMapper dashboardSectionMapper;

    @InjectMocks
    private DashboardSectionService dashboardSectionService;

    private SignedUserDetails currentUser;
    private Dashboard dashboard;

    @BeforeEach
    void setUp() {
        currentUser = new SignedUserDetails(
                List.of((GrantedAuthority) () -> "ROLE_USER"),
                "password",
                "user@test.com",
                "user",
                1L,
                false
        );

        dashboard = new Dashboard();
        dashboard.setId(10L);
        dashboard.setName("Main dashboard");
    }

    @Test
    void createDashboardSection_shouldCreateSectionWithDeviceListSource() {
        DashboardSectionCreateDto dto = new DashboardSectionCreateDto(
                "CPU usage",
                "line",
                List.of("cpu_pct"),
                DashboardSectionSourceType.DEVICE_LIST,
                List.of(100L),
                null,
                null,
                null
        );
        Device device = device(100L);
        DashboardSectionCreateResponseDto responseDto = createResponseDto(200L, DashboardSectionSourceType.DEVICE_LIST);

        when(dashboardService.requireModifiableDashboard(10L, currentUser)).thenReturn(dashboard);
        when(dashboardSectionRepository.countByDashboardId(10L)).thenReturn(2L);
        when(deviceRepository.findAllById(List.of(100L))).thenReturn(List.of(device));
        when(dashboardSectionRepository.save(any(DashboardSection.class))).thenAnswer(invocation -> {
            DashboardSection section = invocation.getArgument(0);
            section.setId(200L);
            return section;
        });
        when(dashboardSectionMapper.toCreateResponseDto(any(DashboardSection.class))).thenReturn(responseDto);

        DashboardSectionCreateResponseDto result = dashboardSectionService.createDashboardSection(10L, dto, currentUser);

        assertThat(result).isEqualTo(responseDto);
        verify(dashboardSectionRepository).save(any(DashboardSection.class));
    }

    @Test
    void createDashboardSection_shouldCreateSectionWithDeviceGroupSource() {
        DashboardSectionCreateDto dto = new DashboardSectionCreateDto(
                "Group metrics",
                "bar",
                List.of("mem_pct"),
                DashboardSectionSourceType.DEVICE_GROUP,
                null,
                50L,
                null,
                null
        );
        DeviceGroup deviceGroup = new DeviceGroup();
        deviceGroup.setId(50L);
        DashboardSectionCreateResponseDto responseDto = createResponseDto(201L, DashboardSectionSourceType.DEVICE_GROUP);

        when(dashboardService.requireModifiableDashboard(10L, currentUser)).thenReturn(dashboard);
        when(dashboardSectionRepository.countByDashboardId(10L)).thenReturn(0L);
        when(deviceGroupRepository.findById(50L)).thenReturn(Optional.of(deviceGroup));
        when(dashboardSectionRepository.save(any(DashboardSection.class))).thenAnswer(invocation -> {
            DashboardSection section = invocation.getArgument(0);
            section.setId(201L);
            return section;
        });
        when(dashboardSectionMapper.toCreateResponseDto(any(DashboardSection.class))).thenReturn(responseDto);

        DashboardSectionCreateResponseDto result = dashboardSectionService.createDashboardSection(10L, dto, currentUser);

        assertThat(result).isEqualTo(responseDto);
    }

    @Test
    void createDashboardSection_shouldCreateSectionWithInterfaceListSource() {
        DashboardSectionCreateDto dto = new DashboardSectionCreateDto(
                "Interface traffic",
                "line",
                List.of("in_bps"),
                DashboardSectionSourceType.INTERFACE_LIST,
                null,
                null,
                List.of(300L),
                null
        );
        DeviceInterface deviceInterface = deviceInterface(300L);
        DashboardSectionCreateResponseDto responseDto = createResponseDto(202L, DashboardSectionSourceType.INTERFACE_LIST);

        when(dashboardService.requireModifiableDashboard(10L, currentUser)).thenReturn(dashboard);
        when(dashboardSectionRepository.countByDashboardId(10L)).thenReturn(0L);
        when(deviceInterfaceRepository.findAllById(List.of(300L))).thenReturn(List.of(deviceInterface));
        when(dashboardSectionRepository.save(any(DashboardSection.class))).thenAnswer(invocation -> {
            DashboardSection section = invocation.getArgument(0);
            section.setId(202L);
            return section;
        });
        when(dashboardSectionMapper.toCreateResponseDto(any(DashboardSection.class))).thenReturn(responseDto);

        DashboardSectionCreateResponseDto result = dashboardSectionService.createDashboardSection(10L, dto, currentUser);

        assertThat(result).isEqualTo(responseDto);
    }

    @Test
    void createDashboardSection_shouldCreateSectionWithInterfaceGroupSource() {
        DashboardSectionCreateDto dto = new DashboardSectionCreateDto(
                "Interface group",
                "line",
                List.of("out_bps"),
                DashboardSectionSourceType.INTERFACE_GROUP,
                null,
                null,
                null,
                70L
        );
        InterfaceGroup interfaceGroup = new InterfaceGroup();
        interfaceGroup.setId(70L);
        DashboardSectionCreateResponseDto responseDto = createResponseDto(203L, DashboardSectionSourceType.INTERFACE_GROUP);

        when(dashboardService.requireModifiableDashboard(10L, currentUser)).thenReturn(dashboard);
        when(dashboardSectionRepository.countByDashboardId(10L)).thenReturn(0L);
        when(interfaceGroupRepository.findById(70L)).thenReturn(Optional.of(interfaceGroup));
        when(dashboardSectionRepository.save(any(DashboardSection.class))).thenAnswer(invocation -> {
            DashboardSection section = invocation.getArgument(0);
            section.setId(203L);
            return section;
        });
        when(dashboardSectionMapper.toCreateResponseDto(any(DashboardSection.class))).thenReturn(responseDto);

        DashboardSectionCreateResponseDto result = dashboardSectionService.createDashboardSection(10L, dto, currentUser);

        assertThat(result).isEqualTo(responseDto);
    }

    @Test
    void createDashboardSection_shouldThrowInvalidRequestException_whenDeviceIdsMissingForDeviceList() {
        DashboardSectionCreateDto dto = new DashboardSectionCreateDto(
                "CPU usage",
                "line",
                List.of("cpu_pct"),
                DashboardSectionSourceType.DEVICE_LIST,
                List.of(),
                null,
                null,
                null
        );

        when(dashboardService.requireModifiableDashboard(10L, currentUser)).thenReturn(dashboard);
        when(dashboardSectionRepository.countByDashboardId(10L)).thenReturn(0L);

        assertThatThrownBy(() -> dashboardSectionService.createDashboardSection(10L, dto, currentUser))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("deviceIds must contain at least one ID");

        verify(dashboardSectionRepository, never()).save(any());
    }

    @Test
    void createDashboardSection_shouldThrowInvalidRequestException_whenExtraSourceFieldsProvided() {
        DashboardSectionCreateDto dto = new DashboardSectionCreateDto(
                "CPU usage",
                "line",
                List.of("cpu_pct"),
                DashboardSectionSourceType.DEVICE_GROUP,
                List.of(100L),
                50L,
                null,
                null
        );

        when(dashboardService.requireModifiableDashboard(10L, currentUser)).thenReturn(dashboard);
        when(dashboardSectionRepository.countByDashboardId(10L)).thenReturn(0L);

        assertThatThrownBy(() -> dashboardSectionService.createDashboardSection(10L, dto, currentUser))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("deviceIds can only be set when sourceType is DEVICE_LIST");
    }

    @Test
    void createDashboardSection_shouldThrowDeviceNotFoundException_whenDeviceDoesNotExist() {
        DashboardSectionCreateDto dto = new DashboardSectionCreateDto(
                "CPU usage",
                "line",
                List.of("cpu_pct"),
                DashboardSectionSourceType.DEVICE_LIST,
                List.of(100L),
                null,
                null,
                null
        );

        when(dashboardService.requireModifiableDashboard(10L, currentUser)).thenReturn(dashboard);
        when(dashboardSectionRepository.countByDashboardId(10L)).thenReturn(0L);
        when(deviceRepository.findAllById(List.of(100L))).thenReturn(List.of());

        assertThatThrownBy(() -> dashboardSectionService.createDashboardSection(10L, dto, currentUser))
                .isInstanceOf(DeviceNotFoundException.class);
    }

    @Test
    void createDashboardSection_shouldThrowDeviceGroupNotFoundException_whenDeviceGroupDoesNotExist() {
        DashboardSectionCreateDto dto = new DashboardSectionCreateDto(
                "Group metrics",
                "bar",
                List.of("mem_pct"),
                DashboardSectionSourceType.DEVICE_GROUP,
                null,
                50L,
                null,
                null
        );

        when(dashboardService.requireModifiableDashboard(10L, currentUser)).thenReturn(dashboard);
        when(dashboardSectionRepository.countByDashboardId(10L)).thenReturn(0L);
        when(deviceGroupRepository.findById(50L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> dashboardSectionService.createDashboardSection(10L, dto, currentUser))
                .isInstanceOf(DeviceGroupNotFoundException.class);
    }

    @Test
    void getDashboardSections_shouldReturnMappedSections() {
        DashboardSection section = section(1L, 0);
        DashboardSectionResponseDto responseDto = new DashboardSectionResponseDto(
                1L, 10L, "CPU", "line", List.of("cpu_pct"), DashboardSectionSourceType.DEVICE_LIST, 1, 0
        );

        when(dashboardService.requireViewableDashboard(10L, currentUser)).thenReturn(dashboard);
        when(dashboardSectionRepository.findByDashboardIdOrderByNameAsc(10L)).thenReturn(List.of(section));
        when(dashboardSectionRepository.findByDashboardIdWithRelations(10L)).thenReturn(List.of(section));
        when(dashboardSectionMapper.toResponseDto(section)).thenReturn(responseDto);

        List<DashboardSectionResponseDto> result = dashboardSectionService.getDashboardSections(10L, currentUser);

        assertThat(result).containsExactly(responseDto);
    }

    @Test
    void getDashboardSections_shouldBackfillMissingSortOrders() {
        DashboardSection first = section(1L, null);
        DashboardSection second = section(2L, null);

        when(dashboardService.requireViewableDashboard(10L, currentUser)).thenReturn(dashboard);
        when(dashboardSectionRepository.findByDashboardIdOrderByNameAsc(10L)).thenReturn(List.of(first, second));
        when(dashboardSectionRepository.findByDashboardIdWithRelations(10L)).thenReturn(List.of(first, second));
        when(dashboardSectionMapper.toResponseDto(any(DashboardSection.class)))
                .thenReturn(new DashboardSectionResponseDto(
                        1L, 10L, "A", "line", List.of(), DashboardSectionSourceType.DEVICE_LIST, 0, 0
                ));

        dashboardSectionService.getDashboardSections(10L, currentUser);

        assertThat(first.getSortOrder()).isZero();
        assertThat(second.getSortOrder()).isEqualTo(1);
    }

    @Test
    void reorderDashboardSections_shouldUpdateSortOrders_whenAllSectionIdsProvided() {
        DashboardSection first = section(1L, 0);
        DashboardSection second = section(2L, 1);
        DashboardSectionOrderDto orderDto = new DashboardSectionOrderDto(List.of(2L, 1L));
        DashboardSectionResponseDto firstDto = new DashboardSectionResponseDto(
                1L, 10L, "A", "line", List.of(), DashboardSectionSourceType.DEVICE_LIST, 0, 1
        );
        DashboardSectionResponseDto secondDto = new DashboardSectionResponseDto(
                2L, 10L, "B", "line", List.of(), DashboardSectionSourceType.DEVICE_LIST, 0, 0
        );

        when(dashboardService.requireModifiableDashboard(10L, currentUser)).thenReturn(dashboard);
        when(dashboardSectionRepository.findByDashboardIdOrderByNameAsc(10L)).thenReturn(List.of(first, second));
        when(dashboardSectionRepository.findAllByDashboardId(10L)).thenReturn(List.of(first, second));
        when(dashboardSectionRepository.findByDashboardIdWithRelations(10L)).thenReturn(List.of(second, first));
        when(dashboardSectionMapper.toResponseDto(second)).thenReturn(secondDto);
        when(dashboardSectionMapper.toResponseDto(first)).thenReturn(firstDto);

        List<DashboardSectionResponseDto> result = dashboardSectionService.reorderDashboardSections(
                10L,
                orderDto,
                currentUser
        );

        assertThat(second.getSortOrder()).isZero();
        assertThat(first.getSortOrder()).isEqualTo(1);
        assertThat(result).containsExactly(secondDto, firstDto);
    }

    @Test
    void reorderDashboardSections_shouldThrowInvalidRequestException_whenDuplicateIdsProvided() {
        DashboardSectionOrderDto orderDto = new DashboardSectionOrderDto(List.of(1L, 1L));

        when(dashboardService.requireModifiableDashboard(10L, currentUser)).thenReturn(dashboard);
        when(dashboardSectionRepository.findByDashboardIdOrderByNameAsc(10L)).thenReturn(List.of(section(1L, 0)));
        when(dashboardSectionRepository.findAllByDashboardId(10L)).thenReturn(List.of(section(1L, 0)));

        assertThatThrownBy(() -> dashboardSectionService.reorderDashboardSections(10L, orderDto, currentUser))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("sectionIds must not contain duplicates");
    }

    @Test
    void reorderDashboardSections_shouldThrowInvalidRequestException_whenSectionIdsDoNotMatchExistingSections() {
        DashboardSectionOrderDto orderDto = new DashboardSectionOrderDto(List.of(1L));

        when(dashboardService.requireModifiableDashboard(10L, currentUser)).thenReturn(dashboard);
        when(dashboardSectionRepository.findByDashboardIdOrderByNameAsc(10L))
                .thenReturn(List.of(section(1L, 0), section(2L, 1)));
        when(dashboardSectionRepository.findAllByDashboardId(10L))
                .thenReturn(List.of(section(1L, 0), section(2L, 1)));

        assertThatThrownBy(() -> dashboardSectionService.reorderDashboardSections(10L, orderDto, currentUser))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("sectionIds must contain every section for this dashboard exactly once");
    }

    @Test
    void getDashboardSection_shouldReturnDetailResponse_whenSectionExists() {
        DashboardSection section = sectionWithDeviceSource(300L, 100L);
        DashboardSectionDetailResponseDto responseDto = new DashboardSectionDetailResponseDto(
                300L,
                10L,
                "CPU",
                "line",
                List.of("cpu_pct"),
                DashboardSectionSourceType.DEVICE_LIST,
                List.of(100L),
                null,
                null,
                null,
                0
        );

        when(dashboardService.requireViewableDashboard(10L, currentUser)).thenReturn(dashboard);
        when(dashboardSectionRepository.findByIdAndDashboardIdWithRelations(300L, 10L))
                .thenReturn(Optional.of(section));
        when(dashboardSectionMapper.toDetailResponseDto(section)).thenReturn(responseDto);

        DashboardSectionDetailResponseDto result = dashboardSectionService.getDashboardSection(10L, 300L, currentUser);

        assertThat(result).isEqualTo(responseDto);
    }

    @Test
    void getDashboardSection_shouldThrowDashboardSectionNotFoundException_whenSectionMissing() {
        when(dashboardService.requireViewableDashboard(10L, currentUser)).thenReturn(dashboard);
        when(dashboardSectionRepository.findByIdAndDashboardIdWithRelations(999L, 10L))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> dashboardSectionService.getDashboardSection(10L, 999L, currentUser))
                .isInstanceOf(DashboardSectionNotFoundException.class);
    }

    @Test
    void updateDashboardSection_shouldUpdateExistingSection() {
        DashboardSection section = sectionWithDeviceSource(300L, 100L);
        DashboardSectionCreateDto dto = new DashboardSectionCreateDto(
                "Updated CPU",
                "area",
                List.of("cpu_pct", "mem_pct"),
                DashboardSectionSourceType.DEVICE_GROUP,
                null,
                50L,
                null,
                null
        );
        DeviceGroup deviceGroup = new DeviceGroup();
        deviceGroup.setId(50L);
        DashboardSectionCreateResponseDto responseDto = createResponseDto(300L, DashboardSectionSourceType.DEVICE_GROUP);

        when(dashboardService.requireModifiableDashboard(10L, currentUser)).thenReturn(dashboard);
        when(dashboardSectionRepository.findByIdAndDashboardIdWithRelations(300L, 10L))
                .thenReturn(Optional.of(section));
        when(deviceGroupRepository.findById(50L)).thenReturn(Optional.of(deviceGroup));
        when(dashboardSectionMapper.toCreateResponseDto(section)).thenReturn(responseDto);

        DashboardSectionCreateResponseDto result = dashboardSectionService.updateDashboardSection(
                10L,
                300L,
                dto,
                currentUser
        );

        assertThat(result).isEqualTo(responseDto);
        assertThat(section.getName()).isEqualTo("Updated CPU");
        assertThat(section.getGraphType()).isEqualTo("area");
        assertThat(section.getSourceType()).isEqualTo(DashboardSectionSourceType.DEVICE_GROUP);
        assertThat(section.getDevices()).isEmpty();
        assertThat(section.getDeviceGroup()).isSameAs(deviceGroup);
    }

    @Test
    void updateDashboardSection_shouldThrowInterfaceNotFoundException_whenInterfaceDoesNotExist() {
        DashboardSection section = section(300L, 0);
        DashboardSectionCreateDto dto = new DashboardSectionCreateDto(
                "Interface traffic",
                "line",
                List.of("in_bps"),
                DashboardSectionSourceType.INTERFACE_LIST,
                null,
                null,
                List.of(300L),
                null
        );

        when(dashboardService.requireModifiableDashboard(10L, currentUser)).thenReturn(dashboard);
        when(dashboardSectionRepository.findByIdAndDashboardIdWithRelations(300L, 10L))
                .thenReturn(Optional.of(section));
        when(deviceInterfaceRepository.findAllById(List.of(300L))).thenReturn(List.of());

        assertThatThrownBy(() -> dashboardSectionService.updateDashboardSection(10L, 300L, dto, currentUser))
                .isInstanceOf(InterfaceNotFoundException.class);
    }

    @Test
    void updateDashboardSection_shouldThrowInterfaceGroupNotFoundException_whenInterfaceGroupDoesNotExist() {
        DashboardSection section = section(300L, 0);
        DashboardSectionCreateDto dto = new DashboardSectionCreateDto(
                "Interface group",
                "line",
                List.of("out_bps"),
                DashboardSectionSourceType.INTERFACE_GROUP,
                null,
                null,
                null,
                70L
        );

        when(dashboardService.requireModifiableDashboard(10L, currentUser)).thenReturn(dashboard);
        when(dashboardSectionRepository.findByIdAndDashboardIdWithRelations(300L, 10L))
                .thenReturn(Optional.of(section));
        when(interfaceGroupRepository.findById(70L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> dashboardSectionService.updateDashboardSection(10L, 300L, dto, currentUser))
                .isInstanceOf(InterfaceGroupNotFoundException.class);
    }

    @Test
    void deleteDashboardSection_shouldDeleteSection_whenSectionExists() {
        DashboardSection section = section(300L, 0);

        when(dashboardService.requireModifiableDashboard(10L, currentUser)).thenReturn(dashboard);
        when(dashboardSectionRepository.findByIdAndDashboardIdWithRelations(300L, 10L))
                .thenReturn(Optional.of(section));

        MessageResponse result = dashboardSectionService.deleteDashboardSection(10L, 300L, currentUser);

        assertThat(result.message()).isEqualTo("Dashboard section deleted successfully");
        verify(dashboardSectionRepository).delete(section);
    }

    private DashboardSection section(Long id, Integer sortOrder) {
        DashboardSection section = new DashboardSection();
        section.setId(id);
        section.setName("Section " + id);
        section.setGraphType("line");
        section.setMetrics(new ArrayList<>());
        section.setSourceType(DashboardSectionSourceType.DEVICE_LIST);
        section.setSortOrder(sortOrder);
        section.setDashboard(dashboard);
        return section;
    }

    private DashboardSection sectionWithDeviceSource(Long sectionId, Long deviceId) {
        DashboardSection section = section(sectionId, 0);
        section.setDevices(new LinkedHashSet<>(List.of(device(deviceId))));
        return section;
    }

    private Device device(Long id) {
        return new Device(id, "1.1.1.1", "host", "vendor", "model", "user", "pass", 22, false, Instant.now(), null, null);
    }

    private DeviceInterface deviceInterface(Long id) {
        return new DeviceInterface(id, 1L, "eth0", 1, "mac", 1000L, "up", "up", Instant.now());
    }

    private DashboardSectionCreateResponseDto createResponseDto(Long id, DashboardSectionSourceType sourceType) {
        return new DashboardSectionCreateResponseDto(
                id,
                10L,
                "Section",
                "line",
                List.of("metric"),
                sourceType,
                sourceType == DashboardSectionSourceType.DEVICE_LIST ? List.of(100L) : null,
                sourceType == DashboardSectionSourceType.DEVICE_GROUP ? 50L : null,
                sourceType == DashboardSectionSourceType.INTERFACE_LIST ? List.of(300L) : null,
                sourceType == DashboardSectionSourceType.INTERFACE_GROUP ? 70L : null,
                0
        );
    }
}
