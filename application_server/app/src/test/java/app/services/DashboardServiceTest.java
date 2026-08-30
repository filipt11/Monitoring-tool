package app.services;

import app.dtos.dashboard.DashboardCreateDto;
import app.dtos.dashboard.DashboardCreateResponseDto;
import app.entities.Dashboard;
import app.entities.DeviceGroupVisibility;
import app.entities.MyUser;
import app.exceptions.DashboardAccessDeniedException;
import app.exceptions.DashboardNotFoundException;
import app.exceptions.InvalidRequestException;
import app.mappers.DashboardMapper;
import app.records.MessageResponse;
import app.repositories.DashboardRepository;
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

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {

    @Mock
    private DashboardRepository dashboardRepository;

    @Mock
    private DashboardMapper dashboardMapper;

    @Mock
    private MyUserRepository myUserRepository;

    @InjectMocks
    private DashboardService dashboardService;

    private MyUser owner;
    private MyUser adminOwner;
    private SignedUserDetails ownerUser;
    private SignedUserDetails adminUser;
    private SignedUserDetails otherUser;

    @BeforeEach
    void setUp() {
        owner = new MyUser();
        owner.setId(1L);
        owner.setUsername("owner");
        owner.setRole("ROLE_USER");

        adminOwner = new MyUser();
        adminOwner.setId(5L);
        adminOwner.setUsername("admin");
        adminOwner.setRole("ROLE_ADMIN");

        ownerUser = signedUser(1L, "owner", "ROLE_USER");
        adminUser = signedUser(5L, "admin", "ROLE_ADMIN");
        otherUser = signedUser(2L, "other", "ROLE_USER");
    }

    @Test
    void createDashboard_shouldCreatePublicDashboard_whenAdminSetsPublicVisibility() {
        DashboardCreateDto dto = new DashboardCreateDto("Admin Dash", "Desc", DeviceGroupVisibility.PUBLIC);

        when(myUserRepository.findById(5L)).thenReturn(Optional.of(adminOwner));
        when(dashboardRepository.save(any(Dashboard.class))).thenAnswer(invocation -> {
            Dashboard dashboard = invocation.getArgument(0);
            dashboard.setId(10L);
            return dashboard;
        });

        DashboardCreateResponseDto result = dashboardService.createDashboard(dto, adminUser);

        assertThat(result.id()).isEqualTo(10L);
        assertThat(result.name()).isEqualTo("Admin Dash");
        assertThat(result.visibility()).isEqualTo(DeviceGroupVisibility.PUBLIC);
        assertThat(result.ownerId()).isEqualTo(5L);
        assertThat(result.ownerUsername()).isEqualTo("admin");
    }

    @Test
    void createDashboard_shouldDefaultToPublic_whenAdminOmitsVisibility() {
        DashboardCreateDto dto = new DashboardCreateDto("Admin Dash", "Desc", null);

        when(myUserRepository.findById(5L)).thenReturn(Optional.of(adminOwner));
        when(dashboardRepository.save(any(Dashboard.class))).thenAnswer(invocation -> {
            Dashboard dashboard = invocation.getArgument(0);
            dashboard.setId(11L);
            return dashboard;
        });

        DashboardCreateResponseDto result = dashboardService.createDashboard(dto, adminUser);

        assertThat(result.visibility()).isEqualTo(DeviceGroupVisibility.PUBLIC);
    }

    @Test
    void createDashboard_shouldForcePrivateDashboard_whenRegularUserCreates() {
        DashboardCreateDto dto = new DashboardCreateDto("User Dash", "Desc", null);

        when(myUserRepository.findById(1L)).thenReturn(Optional.of(owner));
        when(dashboardRepository.save(any(Dashboard.class))).thenAnswer(invocation -> {
            Dashboard dashboard = invocation.getArgument(0);
            dashboard.setId(12L);
            return dashboard;
        });

        DashboardCreateResponseDto result = dashboardService.createDashboard(dto, ownerUser);

        ArgumentCaptor<Dashboard> dashboardCaptor = ArgumentCaptor.forClass(Dashboard.class);
        verify(dashboardRepository).save(dashboardCaptor.capture());
        assertThat(dashboardCaptor.getValue().getVisibility()).isEqualTo(DeviceGroupVisibility.PRIVATE);
        assertThat(result.visibility()).isEqualTo(DeviceGroupVisibility.PRIVATE);
    }

    @Test
    void createDashboard_shouldThrowInvalidRequestException_whenRegularUserRequestsPublicVisibility() {
        DashboardCreateDto dto = new DashboardCreateDto("User Dash", "Desc", DeviceGroupVisibility.PUBLIC);

        assertThatThrownBy(() -> dashboardService.createDashboard(dto, ownerUser))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("Regular users can only create private dashboards");

        verify(dashboardRepository, never()).save(any());
    }

    @Test
    void createDashboard_shouldThrowInvalidRequestException_whenCurrentUserNotFound() {
        DashboardCreateDto dto = new DashboardCreateDto("User Dash", "Desc", null);

        when(myUserRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> dashboardService.createDashboard(dto, ownerUser))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("Current user not found");
    }

    @Test
    void getDashboard_shouldReturnDashboard_whenOwnerRequestsOwnDashboard() {
        Dashboard dashboard = dashboard(1L, owner, DeviceGroupVisibility.PRIVATE);
        DashboardCreateResponseDto responseDto = new DashboardCreateResponseDto(
                1L, "Test", "Desc", DeviceGroupVisibility.PRIVATE, 1L, "owner"
        );

        when(dashboardRepository.findByIdWithOwner(1L)).thenReturn(Optional.of(dashboard));
        when(dashboardMapper.toCreateResponseDto(dashboard)).thenReturn(responseDto);

        DashboardCreateResponseDto result = dashboardService.getDashboard(1L, ownerUser);

        assertThat(result).isEqualTo(responseDto);
    }

    @Test
    void getDashboard_shouldThrowDashboardNotFoundException_whenDashboardDoesNotExist() {
        when(dashboardRepository.findByIdWithOwner(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> dashboardService.getDashboard(99L, ownerUser))
                .isInstanceOf(DashboardNotFoundException.class);
    }

    @Test
    void getDashboard_shouldThrowDashboardNotFoundException_whenOtherUserViewsPrivateDashboard() {
        Dashboard dashboard = dashboard(1L, owner, DeviceGroupVisibility.PRIVATE);
        when(dashboardRepository.findByIdWithOwner(1L)).thenReturn(Optional.of(dashboard));

        assertThatThrownBy(() -> dashboardService.getDashboard(1L, otherUser))
                .isInstanceOf(DashboardNotFoundException.class);
    }

    @Test
    void getDashboard_shouldAllowRegularUserToViewPublicAdminDashboard() {
        Dashboard dashboard = dashboard(1L, adminOwner, DeviceGroupVisibility.PUBLIC);
        DashboardCreateResponseDto responseDto = new DashboardCreateResponseDto(
                1L, "Public", "Desc", DeviceGroupVisibility.PUBLIC, 5L, "admin"
        );

        when(dashboardRepository.findByIdWithOwner(1L)).thenReturn(Optional.of(dashboard));
        when(dashboardMapper.toCreateResponseDto(dashboard)).thenReturn(responseDto);

        DashboardCreateResponseDto result = dashboardService.getDashboard(1L, otherUser);

        assertThat(result).isEqualTo(responseDto);
    }

    @Test
    void getDashboards_shouldReturnEmptyPage_whenNoDashboardsExist() {
        Pageable pageable = PageRequest.of(0, 10);
        when(dashboardRepository.findVisibleToUser(1L, pageable)).thenReturn(Page.empty(pageable));

        Page<DashboardCreateResponseDto> result = dashboardService.getDashboards(pageable, ownerUser);

        assertThat(result.isEmpty()).isTrue();
    }

    @Test
    void getDashboards_shouldUseFindAll_whenCurrentUserIsAdmin() {
        Pageable pageable = PageRequest.of(0, 10);
        Dashboard dashboard = dashboard(1L, owner, DeviceGroupVisibility.PRIVATE);
        Page<Dashboard> page = new PageImpl<>(List.of(dashboard), pageable, 1);
        DashboardCreateResponseDto responseDto = new DashboardCreateResponseDto(
                1L, "Test", "Desc", DeviceGroupVisibility.PRIVATE, 1L, "owner"
        );

        when(dashboardRepository.findAll(pageable)).thenReturn(page);
        when(dashboardRepository.findAllWithOwnerByIdIn(List.of(1L))).thenReturn(List.of(dashboard));
        when(dashboardMapper.toCreateResponseDto(dashboard)).thenReturn(responseDto);

        Page<DashboardCreateResponseDto> result = dashboardService.getDashboards(pageable, adminUser);

        assertThat(result.getContent()).containsExactly(responseDto);
        verify(dashboardRepository).findAll(pageable);
    }

    @Test
    void getDashboards_shouldUseVisibleToUser_whenCurrentUserIsRegularUser() {
        Pageable pageable = PageRequest.of(0, 10);
        Dashboard dashboard = dashboard(1L, owner, DeviceGroupVisibility.PRIVATE);
        Page<Dashboard> page = new PageImpl<>(List.of(dashboard), pageable, 1);
        DashboardCreateResponseDto responseDto = new DashboardCreateResponseDto(
                1L, "Test", "Desc", DeviceGroupVisibility.PRIVATE, 1L, "owner"
        );

        when(dashboardRepository.findVisibleToUser(1L, pageable)).thenReturn(page);
        when(dashboardRepository.findAllWithOwnerByIdIn(List.of(1L))).thenReturn(List.of(dashboard));
        when(dashboardMapper.toCreateResponseDto(dashboard)).thenReturn(responseDto);

        Page<DashboardCreateResponseDto> result = dashboardService.getDashboards(pageable, ownerUser);

        assertThat(result.getContent()).containsExactly(responseDto);
        verify(dashboardRepository).findVisibleToUser(1L, pageable);
    }

    @Test
    void updateDashboard_shouldUpdateDashboard_whenOwnerModifiesOwnDashboard() {
        Dashboard dashboard = dashboard(1L, owner, DeviceGroupVisibility.PRIVATE);
        DashboardCreateDto dto = new DashboardCreateDto("Updated", "New desc", null);

        when(dashboardRepository.findByIdWithOwner(1L)).thenReturn(Optional.of(dashboard));

        DashboardCreateResponseDto result = dashboardService.updateDashboard(1L, dto, ownerUser);

        assertThat(result.name()).isEqualTo("Updated");
        assertThat(result.description()).isEqualTo("New desc");
        assertThat(dashboard.getName()).isEqualTo("Updated");
    }

    @Test
    void updateDashboard_shouldAllowAdminToChangeVisibility() {
        Dashboard dashboard = dashboard(1L, owner, DeviceGroupVisibility.PRIVATE);
        DashboardCreateDto dto = new DashboardCreateDto("Updated", "New desc", DeviceGroupVisibility.PUBLIC);

        when(dashboardRepository.findByIdWithOwner(1L)).thenReturn(Optional.of(dashboard));

        DashboardCreateResponseDto result = dashboardService.updateDashboard(1L, dto, adminUser);

        assertThat(result.visibility()).isEqualTo(DeviceGroupVisibility.PUBLIC);
        assertThat(dashboard.getVisibility()).isEqualTo(DeviceGroupVisibility.PUBLIC);
    }

    @Test
    void updateDashboard_shouldThrowDashboardAccessDeniedException_whenUserCanViewButNotModify() {
        Dashboard dashboard = dashboard(1L, adminOwner, DeviceGroupVisibility.PUBLIC);
        DashboardCreateDto dto = new DashboardCreateDto("Updated", "New desc", null);

        when(dashboardRepository.findByIdWithOwner(1L)).thenReturn(Optional.of(dashboard));

        assertThatThrownBy(() -> dashboardService.updateDashboard(1L, dto, otherUser))
                .isInstanceOf(DashboardAccessDeniedException.class);
    }

    @Test
    void updateDashboard_shouldThrowDashboardNotFoundException_whenOtherUserTriesToModifyPrivateDashboard() {
        Dashboard dashboard = dashboard(1L, owner, DeviceGroupVisibility.PRIVATE);
        DashboardCreateDto dto = new DashboardCreateDto("Updated", "New desc", null);

        when(dashboardRepository.findByIdWithOwner(1L)).thenReturn(Optional.of(dashboard));

        assertThatThrownBy(() -> dashboardService.updateDashboard(1L, dto, otherUser))
                .isInstanceOf(DashboardNotFoundException.class);
    }

    @Test
    void deleteDashboard_shouldDeleteDashboard_whenOwnerDeletesOwnDashboard() {
        Dashboard dashboard = dashboard(1L, owner, DeviceGroupVisibility.PRIVATE);
        when(dashboardRepository.findByIdWithOwner(1L)).thenReturn(Optional.of(dashboard));

        MessageResponse result = dashboardService.deleteDashboard(1L, ownerUser);

        assertThat(result.message()).isEqualTo("Dashboard deleted successfully");
        verify(dashboardRepository).delete(dashboard);
    }

    @Test
    void deleteDashboard_shouldThrowDashboardAccessDeniedException_whenUserCanViewButNotDelete() {
        Dashboard dashboard = dashboard(1L, adminOwner, DeviceGroupVisibility.PUBLIC);
        when(dashboardRepository.findByIdWithOwner(1L)).thenReturn(Optional.of(dashboard));

        assertThatThrownBy(() -> dashboardService.deleteDashboard(1L, otherUser))
                .isInstanceOf(DashboardAccessDeniedException.class);

        verify(dashboardRepository, never()).delete(any());
    }

    @Test
    void deleteDashboard_shouldThrowDashboardNotFoundException_whenOtherUserTriesToDeletePrivateDashboard() {
        Dashboard dashboard = dashboard(1L, owner, DeviceGroupVisibility.PRIVATE);
        when(dashboardRepository.findByIdWithOwner(1L)).thenReturn(Optional.of(dashboard));

        assertThatThrownBy(() -> dashboardService.deleteDashboard(1L, otherUser))
                .isInstanceOf(DashboardNotFoundException.class);

        verify(dashboardRepository, never()).delete(any());
    }

    @Test
    void requireViewableDashboard_shouldReturnDashboard_whenUserHasAccess() {
        Dashboard dashboard = dashboard(1L, owner, DeviceGroupVisibility.PRIVATE);
        when(dashboardRepository.findByIdWithOwner(1L)).thenReturn(Optional.of(dashboard));

        Dashboard result = dashboardService.requireViewableDashboard(1L, ownerUser);

        assertThat(result).isSameAs(dashboard);
    }

    @Test
    void requireModifiableDashboard_shouldReturnDashboard_whenUserCanModify() {
        Dashboard dashboard = dashboard(1L, owner, DeviceGroupVisibility.PRIVATE);
        when(dashboardRepository.findByIdWithOwner(1L)).thenReturn(Optional.of(dashboard));

        Dashboard result = dashboardService.requireModifiableDashboard(1L, ownerUser);

        assertThat(result).isSameAs(dashboard);
    }

    @Test
    void requireModifiableDashboard_shouldThrowDashboardAccessDeniedException_whenUserCanViewButNotModify() {
        Dashboard dashboard = dashboard(1L, adminOwner, DeviceGroupVisibility.PUBLIC);
        when(dashboardRepository.findByIdWithOwner(1L)).thenReturn(Optional.of(dashboard));

        assertThatThrownBy(() -> dashboardService.requireModifiableDashboard(1L, otherUser))
                .isInstanceOf(DashboardAccessDeniedException.class);
    }

    @Test
    void requireModifiableDashboard_shouldThrowDashboardNotFoundException_whenOtherUserCannotViewPrivateDashboard() {
        Dashboard dashboard = dashboard(1L, owner, DeviceGroupVisibility.PRIVATE);
        when(dashboardRepository.findByIdWithOwner(1L)).thenReturn(Optional.of(dashboard));

        assertThatThrownBy(() -> dashboardService.requireModifiableDashboard(1L, otherUser))
                .isInstanceOf(DashboardNotFoundException.class);
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

    private Dashboard dashboard(Long id, MyUser owner, DeviceGroupVisibility visibility) {
        Dashboard dashboard = new Dashboard();
        dashboard.setId(id);
        dashboard.setName("Test");
        dashboard.setDescription("Desc");
        dashboard.setVisibility(visibility);
        dashboard.setOwner(owner);
        return dashboard;
    }
}
