package app.services;

import app.dtos.device.DeviceNoCredentialsResponse;
import app.dtos.deviceGroup.DeviceGroupCreateDto;
import app.dtos.deviceGroup.DeviceGroupCreateResponseDto;
import app.dtos.deviceGroup.DeviceGroupDetailResponseDto;
import app.dtos.deviceGroup.DeviceGroupResponseDto;
import app.entities.Device;
import app.entities.DeviceGroup;
import app.entities.DeviceGroupVisibility;
import app.entities.MyUser;
import app.exceptions.DeviceGroupAccessDeniedException;
import app.exceptions.DeviceGroupNotFoundException;
import app.exceptions.DeviceNotFoundException;
import app.exceptions.InvalidRequestException;
import app.mappers.DeviceGroupMapper;
import app.mappers.DeviceMapper;
import app.records.MessageResponse;
import app.repositories.DeviceGroupRepository;
import app.repositories.DeviceRepository;
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
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class DeviceGroupService {
    private final DeviceGroupRepository deviceGroupRepository;
    private final DeviceGroupMapper deviceGroupMapper;
    private final DeviceMapper deviceMapper;
    private final DeviceRepository deviceRepository;
    private final MyUserRepository myUserRepository;

    public DeviceGroupService(
            DeviceGroupRepository deviceGroupRepository,
            DeviceGroupMapper deviceGroupMapper,
            DeviceMapper deviceMapper,
            DeviceRepository deviceRepository,
            MyUserRepository myUserRepository
    ) {
        this.deviceGroupRepository = deviceGroupRepository;
        this.deviceGroupMapper = deviceGroupMapper;
        this.deviceMapper = deviceMapper;
        this.deviceRepository = deviceRepository;
        this.myUserRepository = myUserRepository;
    }

    @Transactional
    public DeviceGroupCreateResponseDto createDeviceGroup(DeviceGroupCreateDto deviceGroupCreateDto, SignedUserDetails currentUser) {
        DeviceGroupVisibility visibility = resolveVisibilityForCreate(deviceGroupCreateDto.visibility(), currentUser);

        MyUser owner = myUserRepository.findById(currentUser.getId())
                .orElseThrow(() -> new InvalidRequestException("Current user not found"));

        DeviceGroup deviceGroup = new DeviceGroup();
        deviceGroup.setName(deviceGroupCreateDto.name());
        deviceGroup.setDescription(deviceGroupCreateDto.description());
        deviceGroup.setVisibility(visibility);
        deviceGroup.setOwner(owner);

        deviceGroup = deviceGroupRepository.save(deviceGroup);
        return toCreateResponseDto(deviceGroup);
    }

    @Transactional(readOnly = true)
    public DeviceGroupDetailResponseDto getDeviceGroup(Long id, Pageable devicePageable, SignedUserDetails currentUser) {
        DeviceGroup deviceGroup = deviceGroupRepository.findByIdWithOwner(id)
                .orElseThrow(DeviceGroupNotFoundException::new);
        assertCanView(deviceGroup, currentUser);

        Page<DeviceNoCredentialsResponse> devices = getGroupDevicesPage(id, devicePageable);
        return toDetailResponseDto(deviceGroup, devices);
    }

    @Transactional(readOnly = true)
    public Page<DeviceGroupResponseDto> getDeviceGroups(Pageable pageable, SignedUserDetails currentUser) {
        Page<DeviceGroup> page = isAdmin(currentUser)
                ? deviceGroupRepository.findAll(pageable)
                : deviceGroupRepository.findVisibleToUser(currentUser.getId(), pageable);

        if (page.isEmpty()) {
            return Page.empty(pageable);
        }

        List<Long> ids = page.getContent().stream()
                .map(DeviceGroup::getId)
                .toList();

        Map<Long, DeviceGroup> groupsById = deviceGroupRepository.findAllWithOwnerByIdIn(ids).stream()
                .collect(Collectors.toMap(DeviceGroup::getId, Function.identity()));

        Map<Long, Integer> deviceCounts = loadDeviceCounts(ids);

        List<DeviceGroupResponseDto> content = ids.stream()
                .map(groupsById::get)
                .map(group -> deviceGroupMapper.toResponseDto(group, deviceCounts.getOrDefault(group.getId(), 0)))
                .toList();

        return new PageImpl<>(content, pageable, page.getTotalElements());
    }

    @Transactional
    public DeviceGroupCreateResponseDto updateDeviceGroup(Long id, DeviceGroupCreateDto deviceGroupCreateDto, SignedUserDetails currentUser) {
        DeviceGroup deviceGroup = deviceGroupRepository.findByIdWithOwner(id)
                .orElseThrow(DeviceGroupNotFoundException::new);
        assertCanView(deviceGroup, currentUser);
        assertCanModify(deviceGroup, currentUser);

        deviceGroup.setName(deviceGroupCreateDto.name());
        deviceGroup.setDescription(deviceGroupCreateDto.description());

        if (isAdmin(currentUser) && deviceGroupCreateDto.visibility() != null) {
            deviceGroup.setVisibility(deviceGroupCreateDto.visibility());
        }

        return toCreateResponseDto(deviceGroup);
    }

    @Transactional
    public DeviceGroupResponseDto addDevicesToGroup(Long groupId, List<Long> deviceIds, SignedUserDetails currentUser) {
        DeviceGroup deviceGroup = deviceGroupRepository.findByIdWithOwnerAndDevices(groupId)
                .orElseThrow(DeviceGroupNotFoundException::new);
        assertCanView(deviceGroup, currentUser);
        assertCanModify(deviceGroup, currentUser);

        for (Long deviceId : deviceIds) {
            Device device = deviceRepository.findById(deviceId).orElseThrow(DeviceNotFoundException::new);
            deviceGroup.getDevices().add(device);
        }

        deviceGroupRepository.flush();
        return deviceGroupMapper.toResponseDto(deviceGroup, countDevicesInGroup(groupId));
    }

    @Transactional
    public DeviceGroupResponseDto deleteDevicesFromGroup(Long groupId, List<Long> deviceIds, SignedUserDetails currentUser) {
        DeviceGroup deviceGroup = deviceGroupRepository.findByIdWithOwnerAndDevices(groupId)
                .orElseThrow(DeviceGroupNotFoundException::new);
        assertCanView(deviceGroup, currentUser);
        assertCanModify(deviceGroup, currentUser);

        for (Long deviceId : deviceIds) {
            Device device = deviceRepository.findById(deviceId).orElseThrow(DeviceNotFoundException::new);
            deviceGroup.getDevices().remove(device);
        }

        deviceGroupRepository.flush();
        return deviceGroupMapper.toResponseDto(deviceGroup, countDevicesInGroup(groupId));
    }

    @Transactional
    public MessageResponse deleteDeviceGroup(Long groupId, SignedUserDetails currentUser) {
        DeviceGroup deviceGroup = deviceGroupRepository.findByIdWithOwner(groupId)
                .orElseThrow(DeviceGroupNotFoundException::new);
        assertCanView(deviceGroup, currentUser);
        assertCanModify(deviceGroup, currentUser);
        deviceGroupRepository.delete(deviceGroup);
        return new MessageResponse("Device group deleted successfully");
    }

    private Page<DeviceNoCredentialsResponse> getGroupDevicesPage(Long groupId, Pageable devicePageable) {
        return deviceRepository.findByDeviceGroupId(groupId, devicePageable)
                .map(deviceMapper::toNoCredentialsDto);
    }

    private Map<Long, Integer> loadDeviceCounts(List<Long> ids) {
        return deviceGroupRepository.countDevicesByGroupIds(ids).stream()
                .collect(Collectors.toMap(
                        row -> (Long) row[0],
                        row -> ((Number) row[1]).intValue()
                ));
    }

    private int countDevicesInGroup(Long groupId) {
        return loadDeviceCounts(List.of(groupId)).getOrDefault(groupId, 0);
    }

    private DeviceGroupVisibility resolveVisibilityForCreate(DeviceGroupVisibility requestedVisibility, SignedUserDetails currentUser) {
        if (isAdmin(currentUser)) {
            if (requestedVisibility == null) {
                return DeviceGroupVisibility.PUBLIC;
            }
            if (requestedVisibility == DeviceGroupVisibility.PUBLIC || requestedVisibility == DeviceGroupVisibility.ADMIN_ONLY) {
                return requestedVisibility;
            }
            return DeviceGroupVisibility.PRIVATE;
        }

        if (requestedVisibility != null && requestedVisibility != DeviceGroupVisibility.PRIVATE) {
            throw new InvalidRequestException("Regular users can only create private device groups");
        }
        return DeviceGroupVisibility.PRIVATE;
    }

    private void assertCanView(DeviceGroup deviceGroup, SignedUserDetails currentUser) {
        if (isAdmin(currentUser)) {
            return;
        }

        if (deviceGroup.getVisibility() == DeviceGroupVisibility.PUBLIC) {
            return;
        }

        if (deviceGroup.getVisibility() == DeviceGroupVisibility.PRIVATE
                && deviceGroup.getOwner() != null
                && deviceGroup.getOwner().getId().equals(currentUser.getId())) {
            return;
        }

        throw new DeviceGroupNotFoundException();
    }

    private void assertCanModify(DeviceGroup deviceGroup, SignedUserDetails currentUser) {
        if (isAdmin(currentUser)) {
            return;
        }

        if (deviceGroup.getVisibility() == DeviceGroupVisibility.PRIVATE
                && deviceGroup.getOwner() != null
                && deviceGroup.getOwner().getId().equals(currentUser.getId())) {
            return;
        }

        throw new DeviceGroupAccessDeniedException();
    }

    private boolean isAdmin(SignedUserDetails currentUser) {
        return currentUser.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_ADMIN"::equals);
    }

    private DeviceGroupCreateResponseDto toCreateResponseDto(DeviceGroup deviceGroup) {
        Long ownerId = deviceGroup.getOwner() != null ? deviceGroup.getOwner().getId() : null;
        String ownerUsername = deviceGroup.getOwner() != null ? deviceGroup.getOwner().getUsername() : null;
        return new DeviceGroupCreateResponseDto(
                deviceGroup.getId(),
                deviceGroup.getName(),
                deviceGroup.getDescription(),
                deviceGroup.getVisibility(),
                ownerId,
                ownerUsername
        );
    }

    private DeviceGroupDetailResponseDto toDetailResponseDto(
            DeviceGroup deviceGroup,
            Page<DeviceNoCredentialsResponse> devices
    ) {
        Long ownerId = deviceGroup.getOwner() != null ? deviceGroup.getOwner().getId() : null;
        String ownerUsername = deviceGroup.getOwner() != null ? deviceGroup.getOwner().getUsername() : null;
        return new DeviceGroupDetailResponseDto(
                deviceGroup.getId(),
                deviceGroup.getName(),
                deviceGroup.getDescription(),
                deviceGroup.getVisibility(),
                ownerId,
                ownerUsername,
                devices
        );
    }
}
