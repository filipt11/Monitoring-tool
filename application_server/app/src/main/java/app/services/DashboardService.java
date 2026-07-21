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
public class DashboardService {
    private final DashboardRepository dashboardRepository;
    private final DashboardMapper dashboardMapper;
    private final MyUserRepository myUserRepository;

    public DashboardService(
            DashboardRepository dashboardRepository,
            DashboardMapper dashboardMapper,
            MyUserRepository myUserRepository
    ) {
        this.dashboardRepository = dashboardRepository;
        this.dashboardMapper = dashboardMapper;
        this.myUserRepository = myUserRepository;
    }

    @Transactional
    public DashboardCreateResponseDto createDashboard(
            DashboardCreateDto dashboardCreateDto,
            SignedUserDetails currentUser
    ) {
        DeviceGroupVisibility visibility = resolveVisibilityForCreate(
                dashboardCreateDto.visibility(),
                currentUser
        );

        MyUser owner = myUserRepository.findById(currentUser.getId())
                .orElseThrow(() -> new InvalidRequestException("Current user not found"));

        Dashboard dashboard = new Dashboard();
        dashboard.setName(dashboardCreateDto.name());
        dashboard.setDescription(dashboardCreateDto.description());
        dashboard.setVisibility(visibility);
        dashboard.setOwner(owner);

        dashboard = dashboardRepository.save(dashboard);
        return toCreateResponseDto(dashboard);
    }

    @Transactional(readOnly = true)
    public DashboardCreateResponseDto getDashboard(Long id, SignedUserDetails currentUser) {
        Dashboard dashboard = dashboardRepository.findByIdWithOwner(id)
                .orElseThrow(DashboardNotFoundException::new);
        assertCanView(dashboard, currentUser);
        return dashboardMapper.toCreateResponseDto(dashboard);
    }

    @Transactional(readOnly = true)
    public Page<DashboardCreateResponseDto> getDashboards(Pageable pageable, SignedUserDetails currentUser) {
        Page<Dashboard> page = isAdmin(currentUser)
                ? dashboardRepository.findAll(pageable)
                : dashboardRepository.findVisibleToUser(currentUser.getId(), pageable);

        if (page.isEmpty()) {
            return Page.empty(pageable);
        }

        List<Long> ids = page.getContent().stream()
                .map(Dashboard::getId)
                .toList();

        Map<Long, Dashboard> dashboardsById = dashboardRepository.findAllWithOwnerByIdIn(ids).stream()
                .collect(Collectors.toMap(Dashboard::getId, Function.identity()));

        List<DashboardCreateResponseDto> content = ids.stream()
                .map(dashboardsById::get)
                .map(dashboardMapper::toCreateResponseDto)
                .toList();

        return new PageImpl<>(content, pageable, page.getTotalElements());
    }

    @Transactional
    public DashboardCreateResponseDto updateDashboard(
            Long id,
            DashboardCreateDto dashboardCreateDto,
            SignedUserDetails currentUser
    ) {
        Dashboard dashboard = dashboardRepository.findByIdWithOwner(id)
                .orElseThrow(DashboardNotFoundException::new);
        assertCanView(dashboard, currentUser);
        assertCanModify(dashboard, currentUser);

        dashboard.setName(dashboardCreateDto.name());
        dashboard.setDescription(dashboardCreateDto.description());

        if (isAdmin(currentUser) && dashboardCreateDto.visibility() != null) {
            dashboard.setVisibility(dashboardCreateDto.visibility());
        }

        return toCreateResponseDto(dashboard);
    }

    @Transactional
    public MessageResponse deleteDashboard(Long id, SignedUserDetails currentUser) {
        Dashboard dashboard = dashboardRepository.findByIdWithOwner(id)
                .orElseThrow(DashboardNotFoundException::new);
        assertCanView(dashboard, currentUser);
        assertCanModify(dashboard, currentUser);

        dashboardRepository.delete(dashboard);
        return new MessageResponse("Dashboard deleted successfully");
    }

    @Transactional(readOnly = true)
    public Dashboard requireViewableDashboard(Long dashboardId, SignedUserDetails currentUser) {
        Dashboard dashboard = dashboardRepository.findByIdWithOwner(dashboardId)
                .orElseThrow(DashboardNotFoundException::new);
        assertCanView(dashboard, currentUser);
        return dashboard;
    }

    @Transactional(readOnly = true)
    public Dashboard requireModifiableDashboard(Long dashboardId, SignedUserDetails currentUser) {
        Dashboard dashboard = dashboardRepository.findByIdWithOwner(dashboardId)
                .orElseThrow(DashboardNotFoundException::new);
        assertCanView(dashboard, currentUser);
        assertCanModify(dashboard, currentUser);
        return dashboard;
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
            throw new InvalidRequestException("Regular users can only create private dashboards");
        }
        return DeviceGroupVisibility.PRIVATE;
    }

    private void assertCanView(Dashboard dashboard, SignedUserDetails currentUser) {
        if (isAdmin(currentUser)) {
            return;
        }

        if (dashboard.getOwner() != null
                && Objects.equals(dashboard.getOwner().getId(), currentUser.getId())) {
            return;
        }

        if (dashboard.getVisibility() == DeviceGroupVisibility.PUBLIC
                && dashboard.getOwner() != null
                && "ROLE_ADMIN".equals(dashboard.getOwner().getRole())) {
            return;
        }

        throw new DashboardNotFoundException();
    }

    private void assertCanModify(Dashboard dashboard, SignedUserDetails currentUser) {
        if (isAdmin(currentUser)) {
            return;
        }

        if (dashboard.getOwner() != null
                && Objects.equals(dashboard.getOwner().getId(), currentUser.getId())) {
            return;
        }

        throw new DashboardAccessDeniedException();
    }

    private DashboardCreateResponseDto toCreateResponseDto(Dashboard dashboard) {
        Long ownerId = dashboard.getOwner() != null ? dashboard.getOwner().getId() : null;
        String ownerUsername = dashboard.getOwner() != null ? dashboard.getOwner().getUsername() : null;
        return new DashboardCreateResponseDto(
                dashboard.getId(),
                dashboard.getName(),
                dashboard.getDescription(),
                dashboard.getVisibility(),
                ownerId,
                ownerUsername
        );
    }

    private boolean isAdmin(SignedUserDetails currentUser) {
        return currentUser.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_ADMIN"::equals);
    }
}
