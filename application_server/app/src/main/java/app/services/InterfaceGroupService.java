package app.services;

import app.dtos.interfaceGroup.InterfaceGroupCreateDto;
import app.dtos.interfaceGroup.InterfaceGroupCreateResponseDto;
import app.dtos.interfaceGroup.InterfaceGroupDetailResponseDto;
import app.dtos.interfaceGroup.InterfaceGroupMemberResponse;
import app.dtos.interfaceGroup.InterfaceGroupResponseDto;
import app.entities.Device;
import app.entities.DeviceGroupVisibility;
import app.entities.DeviceInterface;
import app.entities.InterfaceGroup;
import app.entities.MyUser;
import app.exceptions.InterfaceGroupAccessDeniedException;
import app.exceptions.InterfaceGroupNotFoundException;
import app.exceptions.InterfaceNotFoundException;
import app.exceptions.InvalidRequestException;
import app.mappers.InterfaceGroupMapper;
import app.records.MessageResponse;
import app.repositories.DeviceInterfaceRepository;
import app.repositories.DeviceRepository;
import app.repositories.InterfaceGroupRepository;
import app.repositories.MyUserRepository;
import app.security.SignedUserDetails;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class InterfaceGroupService {
    private final InterfaceGroupRepository interfaceGroupRepository;
    private final InterfaceGroupMapper interfaceGroupMapper;
    private final DeviceInterfaceRepository deviceInterfaceRepository;
    private final DeviceRepository deviceRepository;
    private final MyUserRepository myUserRepository;

    public InterfaceGroupService(
            InterfaceGroupRepository interfaceGroupRepository,
            InterfaceGroupMapper interfaceGroupMapper,
            DeviceInterfaceRepository deviceInterfaceRepository,
            DeviceRepository deviceRepository,
            MyUserRepository myUserRepository
    ) {
        this.interfaceGroupRepository = interfaceGroupRepository;
        this.interfaceGroupMapper = interfaceGroupMapper;
        this.deviceInterfaceRepository = deviceInterfaceRepository;
        this.deviceRepository = deviceRepository;
        this.myUserRepository = myUserRepository;
    }

    @Transactional(readOnly = true)
    public Page<InterfaceGroupMemberResponse> getInterfaceCatalog(Pageable pageable) {
        return deviceInterfaceRepository.findAll(pageable)
                .map(this::toMemberResponse);
    }

    @Transactional
    public InterfaceGroupCreateResponseDto createInterfaceGroup(
            InterfaceGroupCreateDto interfaceGroupCreateDto,
            SignedUserDetails currentUser
    ) {
        DeviceGroupVisibility visibility = resolveVisibilityForCreate(
                interfaceGroupCreateDto.visibility(),
                currentUser
        );

        MyUser owner = myUserRepository.findById(currentUser.getId())
                .orElseThrow(() -> new InvalidRequestException("Current user not found"));

        InterfaceGroup interfaceGroup = new InterfaceGroup();
        interfaceGroup.setName(interfaceGroupCreateDto.name());
        interfaceGroup.setDescription(interfaceGroupCreateDto.description());
        interfaceGroup.setVisibility(visibility);
        interfaceGroup.setOwner(owner);

        interfaceGroup = interfaceGroupRepository.save(interfaceGroup);
        return toCreateResponseDto(interfaceGroup);
    }

    @Transactional(readOnly = true)
    public InterfaceGroupDetailResponseDto getInterfaceGroup(
            Long id,
            Pageable interfacePageable,
            SignedUserDetails currentUser
    ) {
        InterfaceGroup interfaceGroup = interfaceGroupRepository.findByIdWithOwner(id)
                .orElseThrow(InterfaceGroupNotFoundException::new);
        assertCanView(interfaceGroup, currentUser);

        Page<InterfaceGroupMemberResponse> interfaces = getGroupInterfacesPage(id, interfacePageable);
        return toDetailResponseDto(interfaceGroup, interfaces);
    }

    @Transactional
    public Page<InterfaceGroupResponseDto> getInterfaceGroups(Pageable pageable, SignedUserDetails currentUser) {
        interfaceGroupRepository.removeOrphanedInterfaceGroupMemberships();

        Page<InterfaceGroup> page = isAdmin(currentUser)
                ? interfaceGroupRepository.findAll(pageable)
                : interfaceGroupRepository.findVisibleToUser(currentUser.getId(), pageable);

        if (page.isEmpty()) {
            return Page.empty(pageable);
        }

        List<Long> ids = page.getContent().stream()
                .map(InterfaceGroup::getId)
                .toList();

        Map<Long, InterfaceGroup> groupsById = interfaceGroupRepository.findAllWithOwnerByIdIn(ids).stream()
                .collect(Collectors.toMap(InterfaceGroup::getId, Function.identity()));

        Map<Long, Integer> interfaceCounts = loadInterfaceCounts(ids);

        List<InterfaceGroupResponseDto> content = ids.stream()
                .map(groupsById::get)
                .map(group -> interfaceGroupMapper.toResponseDto(
                        group,
                        interfaceCounts.getOrDefault(group.getId(), 0)
                ))
                .toList();

        return new PageImpl<>(content, pageable, page.getTotalElements());
    }

    @Transactional
    public InterfaceGroupCreateResponseDto updateInterfaceGroup(
            Long id,
            InterfaceGroupCreateDto interfaceGroupCreateDto,
            SignedUserDetails currentUser
    ) {
        InterfaceGroup interfaceGroup = interfaceGroupRepository.findByIdWithOwner(id)
                .orElseThrow(InterfaceGroupNotFoundException::new);
        assertCanView(interfaceGroup, currentUser);
        assertCanModify(interfaceGroup, currentUser);

        interfaceGroup.setName(interfaceGroupCreateDto.name());
        interfaceGroup.setDescription(interfaceGroupCreateDto.description());

        if (isAdmin(currentUser) && interfaceGroupCreateDto.visibility() != null) {
            interfaceGroup.setVisibility(interfaceGroupCreateDto.visibility());
        }

        return toCreateResponseDto(interfaceGroup);
    }

    @Transactional
    public InterfaceGroupResponseDto addInterfacesToGroup(
            Long groupId,
            List<Long> interfaceIds,
            SignedUserDetails currentUser
    ) {
        InterfaceGroup interfaceGroup = interfaceGroupRepository.findByIdWithOwnerAndInterfaces(groupId)
                .orElseThrow(InterfaceGroupNotFoundException::new);
        assertCanView(interfaceGroup, currentUser);
        assertCanModify(interfaceGroup, currentUser);

        for (Long interfaceId : interfaceIds) {
            DeviceInterface deviceInterface = deviceInterfaceRepository.findById(interfaceId)
                    .orElseThrow(InterfaceNotFoundException::new);
            interfaceGroup.getInterfaces().add(deviceInterface);
        }

        interfaceGroupRepository.flush();
        return interfaceGroupMapper.toResponseDto(interfaceGroup, countInterfacesInGroup(groupId));
    }

    @Transactional
    public InterfaceGroupResponseDto deleteInterfacesFromGroup(
            Long groupId,
            List<Long> interfaceIds,
            SignedUserDetails currentUser
    ) {
        InterfaceGroup interfaceGroup = interfaceGroupRepository.findByIdWithOwnerAndInterfaces(groupId)
                .orElseThrow(InterfaceGroupNotFoundException::new);
        assertCanView(interfaceGroup, currentUser);
        assertCanModify(interfaceGroup, currentUser);

        for (Long interfaceId : interfaceIds) {
            DeviceInterface deviceInterface = deviceInterfaceRepository.findById(interfaceId)
                    .orElseThrow(InterfaceNotFoundException::new);
            interfaceGroup.getInterfaces().remove(deviceInterface);
        }

        interfaceGroupRepository.flush();
        return interfaceGroupMapper.toResponseDto(interfaceGroup, countInterfacesInGroup(groupId));
    }

    @Transactional
    public MessageResponse deleteInterfaceGroup(Long groupId, SignedUserDetails currentUser) {
        InterfaceGroup interfaceGroup = interfaceGroupRepository.findByIdWithOwner(groupId)
                .orElseThrow(InterfaceGroupNotFoundException::new);
        assertCanView(interfaceGroup, currentUser);
        assertCanModify(interfaceGroup, currentUser);
        interfaceGroupRepository.delete(interfaceGroup);
        return new MessageResponse("Interface group deleted successfully");
    }

    private Page<InterfaceGroupMemberResponse> getGroupInterfacesPage(Long groupId, Pageable interfacePageable) {
        return deviceInterfaceRepository.findByInterfaceGroupId(groupId, interfacePageable)
                .map(this::toMemberResponse);
    }

    private InterfaceGroupMemberResponse toMemberResponse(DeviceInterface deviceInterface) {
        Device device = deviceRepository.findById(deviceInterface.getDeviceId()).orElse(null);

        return new InterfaceGroupMemberResponse(
                deviceInterface.getId(),
                deviceInterface.getDeviceId(),
                device != null ? device.getHostname() : "Unknown",
                device != null ? device.getIp() : "Unknown",
                deviceInterface.getName(),
                deviceInterface.getIfIndex(),
                deviceInterface.getMac(),
                deviceInterface.getSpeedBps(),
                deviceInterface.getAdminStatus(),
                deviceInterface.getOperStatus(),
                deviceInterface.getDiscoveredAt(),
                deviceInterface.getLastSeenAt()
        );
    }

    private Map<Long, Integer> loadInterfaceCounts(List<Long> ids) {
        return interfaceGroupRepository.countInterfacesByGroupIds(ids).stream()
                .collect(Collectors.toMap(
                        row -> ((Number) row[0]).longValue(),
                        row -> ((Number) row[1]).intValue()
                ));
    }

    private int countInterfacesInGroup(Long groupId) {
        return loadInterfaceCounts(List.of(groupId)).getOrDefault(groupId, 0);
    }

    private DeviceGroupVisibility resolveVisibilityForCreate(
            DeviceGroupVisibility requestedVisibility,
            SignedUserDetails currentUser
    ) {
        if (isAdmin(currentUser)) {
            if (requestedVisibility == null) {
                return DeviceGroupVisibility.PUBLIC;
            }
            if (requestedVisibility == DeviceGroupVisibility.PUBLIC
                    || requestedVisibility == DeviceGroupVisibility.ADMIN_ONLY) {
                return requestedVisibility;
            }
            return DeviceGroupVisibility.PRIVATE;
        }

        if (requestedVisibility != null && requestedVisibility != DeviceGroupVisibility.PRIVATE) {
            throw new InvalidRequestException("Regular users can only create private interface groups");
        }
        return DeviceGroupVisibility.PRIVATE;
    }

    private void assertCanView(InterfaceGroup interfaceGroup, SignedUserDetails currentUser) {
        if (isAdmin(currentUser)) {
            return;
        }

        if (interfaceGroup.getVisibility() == DeviceGroupVisibility.PUBLIC) {
            return;
        }

        if (interfaceGroup.getVisibility() == DeviceGroupVisibility.PRIVATE
                && interfaceGroup.getOwner() != null
                && Objects.equals(interfaceGroup.getOwner().getId(), currentUser.getId())) {
            return;
        }

        throw new InterfaceGroupNotFoundException();
    }

    private void assertCanModify(InterfaceGroup interfaceGroup, SignedUserDetails currentUser) {
        if (isAdmin(currentUser)) {
            return;
        }

        if (interfaceGroup.getVisibility() == DeviceGroupVisibility.PRIVATE
                && interfaceGroup.getOwner() != null
                && Objects.equals(interfaceGroup.getOwner().getId(), currentUser.getId())) {
            return;
        }

        throw new InterfaceGroupAccessDeniedException();
    }

    private boolean isAdmin(SignedUserDetails currentUser) {
        return currentUser.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_ADMIN"::equals);
    }

    private InterfaceGroupCreateResponseDto toCreateResponseDto(InterfaceGroup interfaceGroup) {
        Long ownerId = interfaceGroup.getOwner() != null ? interfaceGroup.getOwner().getId() : null;
        String ownerUsername = interfaceGroup.getOwner() != null ? interfaceGroup.getOwner().getUsername() : null;
        return new InterfaceGroupCreateResponseDto(
                interfaceGroup.getId(),
                interfaceGroup.getName(),
                interfaceGroup.getDescription(),
                interfaceGroup.getVisibility(),
                ownerId,
                ownerUsername
        );
    }

    private InterfaceGroupDetailResponseDto toDetailResponseDto(
            InterfaceGroup interfaceGroup,
            Page<InterfaceGroupMemberResponse> interfaces
    ) {
        Long ownerId = interfaceGroup.getOwner() != null ? interfaceGroup.getOwner().getId() : null;
        String ownerUsername = interfaceGroup.getOwner() != null ? interfaceGroup.getOwner().getUsername() : null;
        return new InterfaceGroupDetailResponseDto(
                interfaceGroup.getId(),
                interfaceGroup.getName(),
                interfaceGroup.getDescription(),
                interfaceGroup.getVisibility(),
                ownerId,
                ownerUsername,
                interfaces
        );
    }
}
