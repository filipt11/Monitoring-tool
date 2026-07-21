package app.controllers;

import app.dtos.dashboard.DashboardCreateDto;
import app.dtos.dashboard.DashboardCreateResponseDto;
import app.records.MessageResponse;
import app.security.SignedUserDetails;
import app.services.DashboardService;
import jakarta.validation.Valid;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class DashboardController {
    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/api/dashboard")
    public ResponseEntity<Page<DashboardCreateResponseDto>> getDashboards(
            @ParameterObject @PageableDefault(size = 20, sort = "name", direction = Sort.Direction.ASC) Pageable pageable,
            @AuthenticationPrincipal SignedUserDetails currentUser
    ) {
        return ResponseEntity.ok(dashboardService.getDashboards(pageable, currentUser));
    }

    @GetMapping("/api/dashboard/{id}")
    public ResponseEntity<DashboardCreateResponseDto> getDashboard(
            @PathVariable Long id,
            @AuthenticationPrincipal SignedUserDetails currentUser
    ) {
        return ResponseEntity.ok(dashboardService.getDashboard(id, currentUser));
    }

    @PostMapping("/api/dashboard")
    public ResponseEntity<DashboardCreateResponseDto> createDashboard(
            @RequestBody @Valid DashboardCreateDto dto,
            @AuthenticationPrincipal SignedUserDetails currentUser
    ) {
        return ResponseEntity.ok(dashboardService.createDashboard(dto, currentUser));
    }

    @PutMapping("/api/dashboard/{id}")
    public ResponseEntity<DashboardCreateResponseDto> updateDashboard(
            @PathVariable Long id,
            @RequestBody @Valid DashboardCreateDto dto,
            @AuthenticationPrincipal SignedUserDetails currentUser
    ) {
        return ResponseEntity.ok(dashboardService.updateDashboard(id, dto, currentUser));
    }

    @DeleteMapping("/api/dashboard/{id}")
    public ResponseEntity<MessageResponse> deleteDashboard(
            @PathVariable Long id,
            @AuthenticationPrincipal SignedUserDetails currentUser
    ) {
        return ResponseEntity.ok(dashboardService.deleteDashboard(id, currentUser));
    }

}
