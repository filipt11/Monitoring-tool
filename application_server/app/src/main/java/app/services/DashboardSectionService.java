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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class DashboardSectionService {
    private final DashboardSectionRepository dashboardSectionRepository;
    private final DashboardService dashboardService;
    private final DeviceRepository deviceRepository;
    private final DeviceGroupRepository deviceGroupRepository;
    private final DeviceInterfaceRepository deviceInterfaceRepository;
    private final InterfaceGroupRepository interfaceGroupRepository;
    private final DashboardSectionMapper dashboardSectionMapper;

    public DashboardSectionService(
            DashboardSectionRepository dashboardSectionRepository,
            DashboardService dashboardService,
            DeviceRepository deviceRepository,
            DeviceGroupRepository deviceGroupRepository,
            DeviceInterfaceRepository deviceInterfaceRepository,
            InterfaceGroupRepository interfaceGroupRepository,
            DashboardSectionMapper dashboardSectionMapper
    ) {
        this.dashboardSectionRepository = dashboardSectionRepository;
        this.dashboardService = dashboardService;
        this.deviceRepository = deviceRepository;
        this.deviceGroupRepository = deviceGroupRepository;
        this.deviceInterfaceRepository = deviceInterfaceRepository;
        this.interfaceGroupRepository = interfaceGroupRepository;
        this.dashboardSectionMapper = dashboardSectionMapper;
    }

    @Transactional
    public DashboardSectionCreateResponseDto createDashboardSection(
            Long dashboardId,
            DashboardSectionCreateDto dto,
            SignedUserDetails currentUser
    ) {
        Dashboard dashboard = dashboardService.requireModifiableDashboard(dashboardId, currentUser);

        DashboardSection dashboardSection = new DashboardSection();
        dashboardSection.setName(dto.name());
        dashboardSection.setGraphType(dto.graphType());
        dashboardSection.setMetrics(copyMetrics(dto.metrics()));
        dashboardSection.setDashboard(dashboard);
        dashboardSection.setSortOrder((int) dashboardSectionRepository.countByDashboardId(dashboardId));
        applySource(dashboardSection, dto);

        dashboardSection = dashboardSectionRepository.save(dashboardSection);
        return dashboardSectionMapper.toCreateResponseDto(dashboardSection);
    }

    @Transactional(readOnly = true)
    public List<DashboardSectionResponseDto> getDashboardSections(
            Long dashboardId,
            SignedUserDetails currentUser
    ) {
        dashboardService.requireViewableDashboard(dashboardId, currentUser);
        ensureSortOrders(dashboardId);

        return dashboardSectionRepository.findByDashboardIdWithRelations(dashboardId).stream()
                .map(dashboardSectionMapper::toResponseDto)
                .toList();
    }

    @Transactional
    public List<DashboardSectionResponseDto> reorderDashboardSections(
            Long dashboardId,
            DashboardSectionOrderDto dto,
            SignedUserDetails currentUser
    ) {
        dashboardService.requireModifiableDashboard(dashboardId, currentUser);
        ensureSortOrders(dashboardId);

        List<DashboardSection> sections = dashboardSectionRepository.findAllByDashboardId(dashboardId);
        Set<Long> existingIds = sections.stream()
                .map(DashboardSection::getId)
                .collect(Collectors.toSet());

        List<Long> requestedIds = dto.sectionIds().stream()
                .distinct()
                .toList();

        if (requestedIds.size() != dto.sectionIds().size()) {
            throw new InvalidRequestException("sectionIds must not contain duplicates");
        }

        if (requestedIds.size() != existingIds.size() || !new HashSet<>(requestedIds).equals(existingIds)) {
            throw new InvalidRequestException(
                    "sectionIds must contain every section for this dashboard exactly once"
            );
        }

        Map<Long, DashboardSection> sectionsById = sections.stream()
                .collect(Collectors.toMap(DashboardSection::getId, Function.identity()));

        for (int index = 0; index < requestedIds.size(); index++) {
            DashboardSection section = sectionsById.get(requestedIds.get(index));
            if (section == null) {
                throw new DashboardSectionNotFoundException();
            }
            section.setSortOrder(index);
        }

        return dashboardSectionRepository.findByDashboardIdWithRelations(dashboardId).stream()
                .map(dashboardSectionMapper::toResponseDto)
                .toList();
    }

    private void ensureSortOrders(Long dashboardId) {
        List<DashboardSection> sections = dashboardSectionRepository.findByDashboardIdOrderByNameAsc(dashboardId);
        if (sections.isEmpty()) {
            return;
        }

        boolean needsBackfill = sections.stream().anyMatch(section -> section.getSortOrder() == null)
                || hasDuplicateSortOrders(sections);
        if (!needsBackfill) {
            return;
        }

        for (int index = 0; index < sections.size(); index++) {
            sections.get(index).setSortOrder(index);
        }
    }

    private boolean hasDuplicateSortOrders(List<DashboardSection> sections) {
        if (sections.size() <= 1) {
            return false;
        }

        long distinctOrders = sections.stream()
                .map(DashboardSection::getSortOrder)
                .distinct()
                .count();
        return distinctOrders != sections.size();
    }

    @Transactional(readOnly = true)
    public DashboardSectionDetailResponseDto getDashboardSection(
            Long dashboardId,
            Long sectionId,
            SignedUserDetails currentUser
    ) {
        dashboardService.requireViewableDashboard(dashboardId, currentUser);

        DashboardSection section = dashboardSectionRepository
                .findByIdAndDashboardIdWithRelations(sectionId, dashboardId)
                .orElseThrow(DashboardSectionNotFoundException::new);

        return dashboardSectionMapper.toDetailResponseDto(section);
    }

    @Transactional
    public DashboardSectionCreateResponseDto updateDashboardSection(
            Long dashboardId,
            Long sectionId,
            DashboardSectionCreateDto dto,
            SignedUserDetails currentUser
    ) {
        dashboardService.requireModifiableDashboard(dashboardId, currentUser);

        DashboardSection section = dashboardSectionRepository
                .findByIdAndDashboardIdWithRelations(sectionId, dashboardId)
                .orElseThrow(DashboardSectionNotFoundException::new);

        section.setName(dto.name());
        section.setGraphType(dto.graphType());
        section.setMetrics(copyMetrics(dto.metrics()));
        clearSource(section);
        applySource(section, dto);

        return dashboardSectionMapper.toCreateResponseDto(section);
    }

    @Transactional
    public MessageResponse deleteDashboardSection(
            Long dashboardId,
            Long sectionId,
            SignedUserDetails currentUser
    ) {
        dashboardService.requireModifiableDashboard(dashboardId, currentUser);

        DashboardSection section = dashboardSectionRepository
                .findByIdAndDashboardIdWithRelations(sectionId, dashboardId)
                .orElseThrow(DashboardSectionNotFoundException::new);

        dashboardSectionRepository.delete(section);
        return new MessageResponse("Dashboard section deleted successfully");
    }

    private void clearSource(DashboardSection section) {
        section.getDevices().clear();
        section.setDeviceGroup(null);
        section.getInterfaces().clear();
        section.setInterfaceGroup(null);
    }

    private void applySource(DashboardSection section, DashboardSectionCreateDto dto) {
        DashboardSectionSourceType sourceType = dto.sourceType();
        section.setSourceType(sourceType);

        switch (sourceType) {
            case DEVICE_LIST -> {
                assertNoExtraSources(dto, sourceType);
                section.setDevices(loadDevices(requireNonEmptyIds(dto.deviceIds(), "deviceIds")));
            }
            case DEVICE_GROUP -> {
                assertNoExtraSources(dto, sourceType);
                section.setDeviceGroup(loadDeviceGroup(requireId(dto.deviceGroupId(), "deviceGroupId")));
            }
            case INTERFACE_LIST -> {
                assertNoExtraSources(dto, sourceType);
                section.setInterfaces(loadInterfaces(requireNonEmptyIds(dto.interfaceIds(), "interfaceIds")));
            }
            case INTERFACE_GROUP -> {
                assertNoExtraSources(dto, sourceType);
                section.setInterfaceGroup(loadInterfaceGroup(requireId(dto.interfaceGroupId(), "interfaceGroupId")));
            }
        }
    }

    private void assertNoExtraSources(DashboardSectionCreateDto dto, DashboardSectionSourceType activeType) {
        if (activeType != DashboardSectionSourceType.DEVICE_LIST && hasValues(dto.deviceIds())) {
            throw new InvalidRequestException("deviceIds can only be set when sourceType is DEVICE_LIST");
        }
        if (activeType != DashboardSectionSourceType.DEVICE_GROUP && isProvided(dto.deviceGroupId())) {
            throw new InvalidRequestException("deviceGroupId can only be set when sourceType is DEVICE_GROUP");
        }
        if (activeType != DashboardSectionSourceType.INTERFACE_LIST && hasValues(dto.interfaceIds())) {
            throw new InvalidRequestException("interfaceIds can only be set when sourceType is INTERFACE_LIST");
        }
        if (activeType != DashboardSectionSourceType.INTERFACE_GROUP && isProvided(dto.interfaceGroupId())) {
            throw new InvalidRequestException("interfaceGroupId can only be set when sourceType is INTERFACE_GROUP");
        }
    }

    private List<Long> requireNonEmptyIds(List<Long> ids, String fieldName) {
        List<Long> cleanedIds = cleanIds(ids);
        if (cleanedIds.isEmpty()) {
            throw new InvalidRequestException(fieldName + " must contain at least one ID for the selected sourceType");
        }
        return cleanedIds;
    }

    private Long requireId(Long id, String fieldName) {
        if (!isProvided(id)) {
            throw new InvalidRequestException(fieldName + " is required for the selected sourceType");
        }
        return id;
    }

    private boolean isProvided(Long id) {
        return id != null && id > 0;
    }

    private boolean hasValues(List<Long> ids) {
        return !cleanIds(ids).isEmpty();
    }

    private List<Long> cleanIds(List<Long> ids) {
        if (ids == null) {
            return List.of();
        }

        return ids.stream()
                .filter(id -> id != null && id > 0)
                .distinct()
                .toList();
    }

    private List<String> copyMetrics(List<String> metrics) {
        if (metrics == null || metrics.isEmpty()) {
            return new ArrayList<>();
        }
        return new ArrayList<>(metrics);
    }

    private Set<Device> loadDevices(List<Long> deviceIds) {
        List<Long> uniqueDeviceIds = new ArrayList<>(new LinkedHashSet<>(cleanIds(deviceIds)));
        List<Device> devices = deviceRepository.findAllById(uniqueDeviceIds);
        if (devices.size() != uniqueDeviceIds.size()) {
            throw new DeviceNotFoundException();
        }
        return new LinkedHashSet<>(devices);
    }

    private DeviceGroup loadDeviceGroup(Long deviceGroupId) {
        return deviceGroupRepository.findById(deviceGroupId)
                .orElseThrow(DeviceGroupNotFoundException::new);
    }

    private Set<DeviceInterface> loadInterfaces(List<Long> interfaceIds) {
        List<Long> uniqueInterfaceIds = new ArrayList<>(new LinkedHashSet<>(cleanIds(interfaceIds)));
        List<DeviceInterface> interfaces = deviceInterfaceRepository.findAllById(uniqueInterfaceIds);
        if (interfaces.size() != uniqueInterfaceIds.size()) {
            throw new InterfaceNotFoundException();
        }
        return new LinkedHashSet<>(interfaces);
    }

    private InterfaceGroup loadInterfaceGroup(Long interfaceGroupId) {
        return interfaceGroupRepository.findById(interfaceGroupId)
                .orElseThrow(InterfaceGroupNotFoundException::new);
    }
}
