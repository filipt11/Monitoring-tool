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
class InterfaceGroupServiceTest {

    @Mock
    private InterfaceGroupRepository interfaceGroupRepository;

    @Mock
    private InterfaceGroupMapper interfaceGroupMapper;

    @Mock
    private DeviceInterfaceRepository deviceInterfaceRepository;

    @Mock
    private DeviceRepository deviceRepository;

    @Mock
    private MyUserRepository myUserRepository;

    @InjectMocks
    private InterfaceGroupService interfaceGroupService;

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
    void getInterfaceCatalog_shouldReturnMappedPage() {
        Pageable pageable = PageRequest.of(0, 10);
        DeviceInterface deviceInterface = deviceInterface(10L, 1L);
        Device device = device(1L);
        Page<DeviceInterface> page = new PageImpl<>(List.of(deviceInterface), pageable, 1);

        when(deviceInterfaceRepository.findAll(pageable)).thenReturn(page);
        when(deviceRepository.findById(1L)).thenReturn(Optional.of(device));

        Page<InterfaceGroupMemberResponse> result = interfaceGroupService.getInterfaceCatalog(pageable);

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().getFirst().id()).isEqualTo(10L);
        assertThat(result.getContent().getFirst().deviceHostname()).isEqualTo("router");
    }

    @Test
    void getInterfaceCatalog_shouldUseUnknownLabels_whenDeviceNotFound() {
        Pageable pageable = PageRequest.of(0, 10);
        DeviceInterface deviceInterface = deviceInterface(10L, 99L);
        Page<DeviceInterface> page = new PageImpl<>(List.of(deviceInterface), pageable, 1);

        when(deviceInterfaceRepository.findAll(pageable)).thenReturn(page);
        when(deviceRepository.findById(99L)).thenReturn(Optional.empty());

        Page<InterfaceGroupMemberResponse> result = interfaceGroupService.getInterfaceCatalog(pageable);

        assertThat(result.getContent().getFirst().deviceHostname()).isEqualTo("Unknown");
        assertThat(result.getContent().getFirst().deviceIp()).isEqualTo("Unknown");
    }

    @Test
    void getInterfaceById_shouldReturnInterface_whenItExists() {
        DeviceInterface deviceInterface = deviceInterface(10L, 1L);
        Device device = device(1L);

        when(deviceInterfaceRepository.findById(10L)).thenReturn(Optional.of(deviceInterface));
        when(deviceRepository.findById(1L)).thenReturn(Optional.of(device));

        InterfaceGroupMemberResponse result = interfaceGroupService.getInterfaceById(10L);

        assertThat(result.id()).isEqualTo(10L);
        assertThat(result.deviceHostname()).isEqualTo("router");
    }

    @Test
    void getInterfaceById_shouldThrowInterfaceNotFoundException_whenInterfaceDoesNotExist() {
        when(deviceInterfaceRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> interfaceGroupService.getInterfaceById(99L))
                .isInstanceOf(InterfaceNotFoundException.class);
    }

    @Test
    void createInterfaceGroup_shouldCreatePublicGroup_whenAdminSetsPublicVisibility() {
        InterfaceGroupCreateDto dto = new InterfaceGroupCreateDto("Uplinks", "Desc", DeviceGroupVisibility.PUBLIC);

        when(myUserRepository.findById(5L)).thenReturn(Optional.of(owner));
        when(interfaceGroupRepository.save(any(InterfaceGroup.class))).thenAnswer(invocation -> {
            InterfaceGroup group = invocation.getArgument(0);
            group.setId(10L);
            return group;
        });

        InterfaceGroupCreateResponseDto result = interfaceGroupService.createInterfaceGroup(dto, adminUser);

        assertThat(result.id()).isEqualTo(10L);
        assertThat(result.visibility()).isEqualTo(DeviceGroupVisibility.PUBLIC);
    }

    @Test
    void createInterfaceGroup_shouldForcePrivateGroup_whenRegularUserCreates() {
        InterfaceGroupCreateDto dto = new InterfaceGroupCreateDto("My Group", "Desc", null);

        when(myUserRepository.findById(1L)).thenReturn(Optional.of(owner));
        when(interfaceGroupRepository.save(any(InterfaceGroup.class))).thenAnswer(invocation -> {
            InterfaceGroup group = invocation.getArgument(0);
            group.setId(11L);
            return group;
        });

        InterfaceGroupCreateResponseDto result = interfaceGroupService.createInterfaceGroup(dto, ownerUser);

        ArgumentCaptor<InterfaceGroup> groupCaptor = ArgumentCaptor.forClass(InterfaceGroup.class);
        verify(interfaceGroupRepository).save(groupCaptor.capture());
        assertThat(groupCaptor.getValue().getVisibility()).isEqualTo(DeviceGroupVisibility.PRIVATE);
        assertThat(result.visibility()).isEqualTo(DeviceGroupVisibility.PRIVATE);
    }

    @Test
    void createInterfaceGroup_shouldThrowInvalidRequestException_whenRegularUserRequestsPublicVisibility() {
        InterfaceGroupCreateDto dto = new InterfaceGroupCreateDto("My Group", "Desc", DeviceGroupVisibility.PUBLIC);

        assertThatThrownBy(() -> interfaceGroupService.createInterfaceGroup(dto, ownerUser))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("Regular users can only create private interface groups");

        verify(interfaceGroupRepository, never()).save(any());
    }

    @Test
    void getInterfaceGroup_shouldReturnGroupWithInterfaces_whenUserCanViewPublicGroup() {
        Pageable pageable = PageRequest.of(0, 10);
        InterfaceGroup group = interfaceGroup(1L, owner, DeviceGroupVisibility.PUBLIC);
        DeviceInterface deviceInterface = deviceInterface(10L, 1L);
        Device device = device(1L);
        Page<DeviceInterface> interfacePage = new PageImpl<>(List.of(deviceInterface), pageable, 1);

        when(interfaceGroupRepository.findByIdWithOwner(1L)).thenReturn(Optional.of(group));
        when(deviceInterfaceRepository.findByInterfaceGroupId(1L, pageable)).thenReturn(interfacePage);
        when(deviceRepository.findById(1L)).thenReturn(Optional.of(device));

        InterfaceGroupDetailResponseDto result = interfaceGroupService.getInterfaceGroup(1L, pageable, otherUser);

        assertThat(result.id()).isEqualTo(1L);
        assertThat(result.interfaces().getContent()).hasSize(1);
        assertThat(result.interfaces().getContent().getFirst().name()).isEqualTo("eth0");
    }

    @Test
    void getInterfaceGroup_shouldThrowInterfaceGroupNotFoundException_whenOtherUserViewsPrivateGroup() {
        InterfaceGroup group = interfaceGroup(1L, owner, DeviceGroupVisibility.PRIVATE);
        when(interfaceGroupRepository.findByIdWithOwner(1L)).thenReturn(Optional.of(group));

        assertThatThrownBy(() -> interfaceGroupService.getInterfaceGroup(1L, PageRequest.of(0, 10), otherUser))
                .isInstanceOf(InterfaceGroupNotFoundException.class);
    }

    @Test
    void getInterfaceGroups_shouldReturnEmptyPage_whenNoGroupsExist() {
        Pageable pageable = PageRequest.of(0, 10);
        when(interfaceGroupRepository.findVisibleToUser(1L, pageable)).thenReturn(Page.empty(pageable));

        Page<InterfaceGroupResponseDto> result = interfaceGroupService.getInterfaceGroups(pageable, ownerUser);

        assertThat(result.isEmpty()).isTrue();
        verify(interfaceGroupRepository).removeOrphanedInterfaceGroupMemberships();
    }

    @Test
    void getInterfaceGroups_shouldUseFindAll_whenCurrentUserIsAdmin() {
        Pageable pageable = PageRequest.of(0, 10);
        InterfaceGroup group = interfaceGroup(1L, owner, DeviceGroupVisibility.PUBLIC);
        Page<InterfaceGroup> page = new PageImpl<>(List.of(group), pageable, 1);
        InterfaceGroupResponseDto responseDto = new InterfaceGroupResponseDto(
                1L, "Group", "Desc", DeviceGroupVisibility.PUBLIC, 1L, "owner", 3
        );

        when(interfaceGroupRepository.findAll(pageable)).thenReturn(page);
        when(interfaceGroupRepository.findAllWithOwnerByIdIn(List.of(1L))).thenReturn(List.of(group));
        when(interfaceGroupRepository.countInterfacesByGroupIds(List.of(1L)))
                .thenReturn(Collections.singletonList(new Object[]{1L, 3}));
        when(interfaceGroupMapper.toResponseDto(group, 3)).thenReturn(responseDto);

        Page<InterfaceGroupResponseDto> result = interfaceGroupService.getInterfaceGroups(pageable, adminUser);

        assertThat(result.getContent()).containsExactly(responseDto);
    }

    @Test
    void updateInterfaceGroup_shouldUpdateGroup_whenOwnerModifiesPrivateGroup() {
        InterfaceGroup group = interfaceGroup(1L, owner, DeviceGroupVisibility.PRIVATE);
        InterfaceGroupCreateDto dto = new InterfaceGroupCreateDto("Updated", "New desc", null);

        when(interfaceGroupRepository.findByIdWithOwner(1L)).thenReturn(Optional.of(group));

        InterfaceGroupCreateResponseDto result = interfaceGroupService.updateInterfaceGroup(1L, dto, ownerUser);

        assertThat(result.name()).isEqualTo("Updated");
        assertThat(group.getName()).isEqualTo("Updated");
    }

    @Test
    void updateInterfaceGroup_shouldThrowInterfaceGroupAccessDeniedException_whenNonAdminTriesToModifyPublicGroup() {
        InterfaceGroup group = interfaceGroup(1L, owner, DeviceGroupVisibility.PUBLIC);
        InterfaceGroupCreateDto dto = new InterfaceGroupCreateDto("Updated", "New desc", null);

        when(interfaceGroupRepository.findByIdWithOwner(1L)).thenReturn(Optional.of(group));

        assertThatThrownBy(() -> interfaceGroupService.updateInterfaceGroup(1L, dto, ownerUser))
                .isInstanceOf(InterfaceGroupAccessDeniedException.class);
    }

    @Test
    void addInterfacesToGroup_shouldAddInterfaces_whenOwnerModifiesPrivateGroup() {
        InterfaceGroup group = interfaceGroupWithInterfaces(1L, owner, DeviceGroupVisibility.PRIVATE);
        DeviceInterface deviceInterface = deviceInterface(10L, 1L);
        InterfaceGroupResponseDto responseDto = new InterfaceGroupResponseDto(
                1L, "Group", "Desc", DeviceGroupVisibility.PRIVATE, 1L, "owner", 1
        );

        when(interfaceGroupRepository.findByIdWithOwnerAndInterfaces(1L)).thenReturn(Optional.of(group));
        when(deviceInterfaceRepository.findById(10L)).thenReturn(Optional.of(deviceInterface));
        when(interfaceGroupRepository.countInterfacesByGroupIds(List.of(1L)))
                .thenReturn(Collections.singletonList(new Object[]{1L, 1}));
        when(interfaceGroupMapper.toResponseDto(group, 1)).thenReturn(responseDto);

        InterfaceGroupResponseDto result = interfaceGroupService.addInterfacesToGroup(1L, List.of(10L), ownerUser);

        assertThat(result).isEqualTo(responseDto);
        assertThat(group.getInterfaces()).contains(deviceInterface);
        verify(interfaceGroupRepository).flush();
    }

    @Test
    void addInterfacesToGroup_shouldThrowInterfaceNotFoundException_whenInterfaceDoesNotExist() {
        InterfaceGroup group = interfaceGroupWithInterfaces(1L, owner, DeviceGroupVisibility.PRIVATE);

        when(interfaceGroupRepository.findByIdWithOwnerAndInterfaces(1L)).thenReturn(Optional.of(group));
        when(deviceInterfaceRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> interfaceGroupService.addInterfacesToGroup(1L, List.of(99L), ownerUser))
                .isInstanceOf(InterfaceNotFoundException.class);
    }

    @Test
    void deleteInterfacesFromGroup_shouldRemoveInterfaces_whenOwnerModifiesPrivateGroup() {
        DeviceInterface deviceInterface = deviceInterface(10L, 1L);
        InterfaceGroup group = interfaceGroupWithInterfaces(1L, owner, DeviceGroupVisibility.PRIVATE);
        group.getInterfaces().add(deviceInterface);
        InterfaceGroupResponseDto responseDto = new InterfaceGroupResponseDto(
                1L, "Group", "Desc", DeviceGroupVisibility.PRIVATE, 1L, "owner", 0
        );

        when(interfaceGroupRepository.findByIdWithOwnerAndInterfaces(1L)).thenReturn(Optional.of(group));
        when(deviceInterfaceRepository.findById(10L)).thenReturn(Optional.of(deviceInterface));
        when(interfaceGroupRepository.countInterfacesByGroupIds(List.of(1L)))
                .thenReturn(Collections.singletonList(new Object[]{1L, 0}));
        when(interfaceGroupMapper.toResponseDto(group, 0)).thenReturn(responseDto);

        InterfaceGroupResponseDto result = interfaceGroupService.deleteInterfacesFromGroup(1L, List.of(10L), ownerUser);

        assertThat(result).isEqualTo(responseDto);
        assertThat(group.getInterfaces()).doesNotContain(deviceInterface);
    }

    @Test
    void deleteInterfaceGroup_shouldDeleteGroup_whenOwnerDeletesPrivateGroup() {
        InterfaceGroup group = interfaceGroup(1L, owner, DeviceGroupVisibility.PRIVATE);
        when(interfaceGroupRepository.findByIdWithOwner(1L)).thenReturn(Optional.of(group));

        MessageResponse result = interfaceGroupService.deleteInterfaceGroup(1L, ownerUser);

        assertThat(result.message()).isEqualTo("Interface group deleted successfully");
        verify(interfaceGroupRepository).delete(group);
    }

    @Test
    void deleteInterfaceGroup_shouldThrowInterfaceGroupAccessDeniedException_whenNonAdminDeletesPublicGroup() {
        InterfaceGroup group = interfaceGroup(1L, owner, DeviceGroupVisibility.PUBLIC);
        when(interfaceGroupRepository.findByIdWithOwner(1L)).thenReturn(Optional.of(group));

        assertThatThrownBy(() -> interfaceGroupService.deleteInterfaceGroup(1L, otherUser))
                .isInstanceOf(InterfaceGroupAccessDeniedException.class);

        verify(interfaceGroupRepository, never()).delete(any());
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

    private InterfaceGroup interfaceGroup(Long id, MyUser owner, DeviceGroupVisibility visibility) {
        InterfaceGroup group = new InterfaceGroup();
        group.setId(id);
        group.setName("Group");
        group.setDescription("Desc");
        group.setVisibility(visibility);
        group.setOwner(owner);
        return group;
    }

    private InterfaceGroup interfaceGroupWithInterfaces(Long id, MyUser owner, DeviceGroupVisibility visibility) {
        InterfaceGroup group = interfaceGroup(id, owner, visibility);
        group.setInterfaces(new HashSet<>());
        return group;
    }

    private Device device(Long id) {
        return new Device(id, "1.1.1.1", "router", "Cisco", "9000", "user", "pass", 443, false, Instant.now(), null, null);
    }

    private DeviceInterface deviceInterface(Long id, Long deviceId) {
        return new DeviceInterface(id, deviceId, "eth0", 1, "mac", 1000L, "up", "up", Instant.now());
    }
}
