package app.services;

import app.dtos.deviceGroup.DeviceGroupCreateDto;
import app.dtos.deviceGroup.DeviceGroupCreateResponseDto;
import app.dtos.deviceGroup.DeviceGroupDetailResponseDto;
import app.dtos.deviceGroup.DeviceGroupResponseDto;
import app.dtos.device.DeviceNoCredentialsResponse;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.GrantedAuthority;

import java.time.Instant;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceGroupServiceTest {

    @Mock
    private DeviceGroupRepository deviceGroupRepository;

    @Mock
    private DeviceGroupMapper deviceGroupMapper;

    @Mock
    private DeviceMapper deviceMapper;

    @Mock
    private DeviceRepository deviceRepository;

    @Mock
    private MyUserRepository myUserRepository;

    @InjectMocks
    private DeviceGroupService deviceGroupService;

    private MyUser owner;
    private SignedUserDetails ownerUser;
    private SignedUserDetails adminUser;
    private SignedUserDetails otherUser;

    @BeforeEach
    void setUp() {
        owner = new MyUser();
        owner.setId(1L);
        owner.setUsername("owner");
        owner.setRole("ROLE_USER");

        ownerUser = signedUser(1L, "owner", "ROLE_USER");
        adminUser = signedUser(5L, "admin", "ROLE_ADMIN");
        otherUser = signedUser(2L, "other", "ROLE_USER");
    }

    @Test
    void createDeviceGroup_shouldCreatePublicGroup_whenAdminSetsPublicVisibility() {
        DeviceGroupCreateDto dto = new DeviceGroupCreateDto("Group A", "Desc", DeviceGroupVisibility.PUBLIC);

        when(myUserRepository.findById(5L)).thenReturn(Optional.of(owner));
        when(deviceGroupRepository.save(any(DeviceGroup.class))).thenAnswer(invocation -> {
            DeviceGroup group = invocation.getArgument(0);
            group.setId(10L);
            return group;
        });

        DeviceGroupCreateResponseDto result = deviceGroupService.createDeviceGroup(dto, adminUser);

        assertThat(result.id()).isEqualTo(10L);
        assertThat(result.visibility()).isEqualTo(DeviceGroupVisibility.PUBLIC);
    }

    @Test
    void createDeviceGroup_shouldForcePrivateGroup_whenRegularUserCreates() {
        DeviceGroupCreateDto dto = new DeviceGroupCreateDto("My Group", "Desc", null);

        when(myUserRepository.findById(1L)).thenReturn(Optional.of(owner));
        when(deviceGroupRepository.save(any(DeviceGroup.class))).thenAnswer(invocation -> {
            DeviceGroup group = invocation.getArgument(0);
            group.setId(11L);
            return group;
        });

        DeviceGroupCreateResponseDto result = deviceGroupService.createDeviceGroup(dto, ownerUser);

        ArgumentCaptor<DeviceGroup> groupCaptor = ArgumentCaptor.forClass(DeviceGroup.class);
        verify(deviceGroupRepository).save(groupCaptor.capture());
        assertThat(groupCaptor.getValue().getVisibility()).isEqualTo(DeviceGroupVisibility.PRIVATE);
        assertThat(result.visibility()).isEqualTo(DeviceGroupVisibility.PRIVATE);
    }

    @Test
    void createDeviceGroup_shouldThrowInvalidRequestException_whenRegularUserRequestsPublicVisibility() {
        DeviceGroupCreateDto dto = new DeviceGroupCreateDto("My Group", "Desc", DeviceGroupVisibility.PUBLIC);

        assertThatThrownBy(() -> deviceGroupService.createDeviceGroup(dto, ownerUser))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("Regular users can only create private device groups");

        verify(deviceGroupRepository, never()).save(any());
    }

    @Test
    void getDeviceGroup_shouldReturnGroupWithDevices_whenUserCanViewPublicGroup() {
        Pageable pageable = PageRequest.of(0, 10);
        DeviceGroup group = deviceGroup(1L, owner, DeviceGroupVisibility.PUBLIC);
        Device device = device(100L);
        DeviceNoCredentialsResponse deviceDto = new DeviceNoCredentialsResponse(
                100L, "1.1.1.1", "router", "Cisco", "9000", 443, false
        );
        Page<Device> devicePage = new PageImpl<>(List.of(device), pageable, 1);

        when(deviceGroupRepository.findByIdWithOwner(1L)).thenReturn(Optional.of(group));
        when(deviceRepository.findByDeviceGroupId(1L, pageable)).thenReturn(devicePage);
        when(deviceMapper.toNoCredentialsDto(device)).thenReturn(deviceDto);

        DeviceGroupDetailResponseDto result = deviceGroupService.getDeviceGroup(1L, pageable, otherUser);

        assertThat(result.id()).isEqualTo(1L);
        assertThat(result.devices().getContent()).containsExactly(deviceDto);
    }

    @Test
    void getDeviceGroup_shouldThrowDeviceGroupNotFoundException_whenOtherUserViewsPrivateGroup() {
        DeviceGroup group = deviceGroup(1L, owner, DeviceGroupVisibility.PRIVATE);
        when(deviceGroupRepository.findByIdWithOwner(1L)).thenReturn(Optional.of(group));

        assertThatThrownBy(() -> deviceGroupService.getDeviceGroup(1L, PageRequest.of(0, 10), otherUser))
                .isInstanceOf(DeviceGroupNotFoundException.class);
    }

    @Test
    void getDeviceGroups_shouldReturnEmptyPage_whenNoGroupsExist() {
        Pageable pageable = PageRequest.of(0, 10);
        when(deviceGroupRepository.findVisibleToUser(1L, pageable)).thenReturn(Page.empty(pageable));

        Page<DeviceGroupResponseDto> result = deviceGroupService.getDeviceGroups(pageable, ownerUser);

        assertThat(result.isEmpty()).isTrue();
        verify(deviceGroupRepository).removeOrphanedDeviceGroupMemberships();
    }

    @Test
    void getDeviceGroups_shouldUseFindAll_whenCurrentUserIsAdmin() {
        Pageable pageable = PageRequest.of(0, 10);
        DeviceGroup group = deviceGroup(1L, owner, DeviceGroupVisibility.PUBLIC);
        Page<DeviceGroup> page = new PageImpl<>(List.of(group), pageable, 1);
        DeviceGroupResponseDto responseDto = new DeviceGroupResponseDto(
                1L, "Group", "Desc", DeviceGroupVisibility.PUBLIC, 1L, "owner", 2, null
        );

        when(deviceGroupRepository.findAll(pageable)).thenReturn(page);
        when(deviceGroupRepository.findAllWithOwnerByIdIn(List.of(1L))).thenReturn(List.of(group));
        when(deviceGroupRepository.countDevicesByGroupIds(List.of(1L)))
                .thenReturn(Collections.singletonList(new Object[]{1L, 2}));
        when(deviceGroupMapper.toResponseDto(group, 2)).thenReturn(responseDto);

        Page<DeviceGroupResponseDto> result = deviceGroupService.getDeviceGroups(pageable, adminUser);

        assertThat(result.getContent()).containsExactly(responseDto);
    }

    @Test
    void updateDeviceGroup_shouldUpdateGroup_whenOwnerModifiesPrivateGroup() {
        DeviceGroup group = deviceGroup(1L, owner, DeviceGroupVisibility.PRIVATE);
        DeviceGroupCreateDto dto = new DeviceGroupCreateDto("Updated", "New desc", null);

        when(deviceGroupRepository.findByIdWithOwner(1L)).thenReturn(Optional.of(group));

        DeviceGroupCreateResponseDto result = deviceGroupService.updateDeviceGroup(1L, dto, ownerUser);

        assertThat(result.name()).isEqualTo("Updated");
        assertThat(group.getName()).isEqualTo("Updated");
    }

    @Test
    void updateDeviceGroup_shouldThrowDeviceGroupAccessDeniedException_whenNonAdminTriesToModifyPublicGroup() {
        DeviceGroup group = deviceGroup(1L, owner, DeviceGroupVisibility.PUBLIC);
        DeviceGroupCreateDto dto = new DeviceGroupCreateDto("Updated", "New desc", null);

        when(deviceGroupRepository.findByIdWithOwner(1L)).thenReturn(Optional.of(group));

        assertThatThrownBy(() -> deviceGroupService.updateDeviceGroup(1L, dto, ownerUser))
                .isInstanceOf(DeviceGroupAccessDeniedException.class);
    }

    @Test
    void updateDeviceGroup_shouldThrowDeviceGroupNotFoundException_whenOtherUserTriesToModifyPrivateGroup() {
        DeviceGroup group = deviceGroup(1L, owner, DeviceGroupVisibility.PRIVATE);
        DeviceGroupCreateDto dto = new DeviceGroupCreateDto("Updated", "New desc", null);

        when(deviceGroupRepository.findByIdWithOwner(1L)).thenReturn(Optional.of(group));

        assertThatThrownBy(() -> deviceGroupService.updateDeviceGroup(1L, dto, otherUser))
                .isInstanceOf(DeviceGroupNotFoundException.class);
    }

    @Test
    void addDevicesToGroup_shouldAddDevices_whenOwnerModifiesPrivateGroup() {
        DeviceGroup group = deviceGroupWithDevices(1L, owner, DeviceGroupVisibility.PRIVATE);
        Device device = device(100L);
        DeviceGroupResponseDto responseDto = new DeviceGroupResponseDto(
                1L, "Group", "Desc", DeviceGroupVisibility.PRIVATE, 1L, "owner", 1, null
        );

        when(deviceGroupRepository.findByIdWithOwnerAndDevices(1L)).thenReturn(Optional.of(group));
        when(deviceRepository.findById(100L)).thenReturn(Optional.of(device));
        when(deviceGroupRepository.countDevicesByGroupIds(List.of(1L)))
                .thenReturn(Collections.singletonList(new Object[]{1L, 1}));
        when(deviceGroupMapper.toResponseDto(group, 1)).thenReturn(responseDto);

        DeviceGroupResponseDto result = deviceGroupService.addDevicesToGroup(1L, List.of(100L), ownerUser);

        assertThat(result).isEqualTo(responseDto);
        assertThat(group.getDevices()).contains(device);
        verify(deviceGroupRepository).flush();
    }

    @Test
    void addDevicesToGroup_shouldThrowDeviceNotFoundException_whenDeviceDoesNotExist() {
        DeviceGroup group = deviceGroupWithDevices(1L, owner, DeviceGroupVisibility.PRIVATE);

        when(deviceGroupRepository.findByIdWithOwnerAndDevices(1L)).thenReturn(Optional.of(group));
        when(deviceRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> deviceGroupService.addDevicesToGroup(1L, List.of(999L), ownerUser))
                .isInstanceOf(DeviceNotFoundException.class);
    }

    @Test
    void deleteDevicesFromGroup_shouldRemoveDevices_whenOwnerModifiesPrivateGroup() {
        Device device = device(100L);
        DeviceGroup group = deviceGroupWithDevices(1L, owner, DeviceGroupVisibility.PRIVATE);
        group.getDevices().add(device);
        DeviceGroupResponseDto responseDto = new DeviceGroupResponseDto(
                1L, "Group", "Desc", DeviceGroupVisibility.PRIVATE, 1L, "owner", 0, null
        );

        when(deviceGroupRepository.findByIdWithOwnerAndDevices(1L)).thenReturn(Optional.of(group));
        when(deviceRepository.findById(100L)).thenReturn(Optional.of(device));
        when(deviceGroupRepository.countDevicesByGroupIds(List.of(1L)))
                .thenReturn(Collections.singletonList(new Object[]{1L, 0}));
        when(deviceGroupMapper.toResponseDto(group, 0)).thenReturn(responseDto);

        DeviceGroupResponseDto result = deviceGroupService.deleteDevicesFromGroup(1L, List.of(100L), ownerUser);

        assertThat(result).isEqualTo(responseDto);
        assertThat(group.getDevices()).doesNotContain(device);
    }

    @Test
    void deleteDeviceGroup_shouldDeleteGroup_whenOwnerDeletesPrivateGroup() {
        DeviceGroup group = deviceGroup(1L, owner, DeviceGroupVisibility.PRIVATE);
        when(deviceGroupRepository.findByIdWithOwner(1L)).thenReturn(Optional.of(group));

        MessageResponse result = deviceGroupService.deleteDeviceGroup(1L, ownerUser);

        assertThat(result.message()).isEqualTo("Device group deleted successfully");
        verify(deviceGroupRepository).delete(group);
    }

    @Test
    void deleteDeviceGroup_shouldThrowDeviceGroupAccessDeniedException_whenNonAdminDeletesPublicGroup() {
        DeviceGroup group = deviceGroup(1L, owner, DeviceGroupVisibility.PUBLIC);
        when(deviceGroupRepository.findByIdWithOwner(1L)).thenReturn(Optional.of(group));

        assertThatThrownBy(() -> deviceGroupService.deleteDeviceGroup(1L, otherUser))
                .isInstanceOf(DeviceGroupAccessDeniedException.class);

        verify(deviceGroupRepository, never()).delete(any());
    }

    private SignedUserDetails signedUser(long id, String username, String role) {
        return new SignedUserDetails(
                List.of((GrantedAuthority) () -> role),
                "password",
                username + "@test.com",
                username,
                id,
                false
        );
    }

    private DeviceGroup deviceGroup(Long id, MyUser owner, DeviceGroupVisibility visibility) {
        DeviceGroup group = new DeviceGroup();
        group.setId(id);
        group.setName("Group");
        group.setDescription("Desc");
        group.setVisibility(visibility);
        group.setOwner(owner);
        return group;
    }

    private DeviceGroup deviceGroupWithDevices(Long id, MyUser owner, DeviceGroupVisibility visibility) {
        DeviceGroup group = deviceGroup(id, owner, visibility);
        group.setDevices(new HashSet<>());
        return group;
    }

    private Device device(Long id) {
        return new Device(id, "1.1.1.1", "router", "Cisco", "9000", "user", "pass", 443, false, Instant.now(), null, null);
    }
}
