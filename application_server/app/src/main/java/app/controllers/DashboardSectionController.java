package app.controllers;

import app.dtos.dashboardSection.DashboardSectionCreateDto;
import app.dtos.dashboardSection.DashboardSectionCreateResponseDto;
import app.dtos.dashboardSection.DashboardSectionDetailResponseDto;
import app.dtos.dashboardSection.DashboardSectionOrderDto;
import app.dtos.dashboardSection.DashboardSectionResponseDto;
import app.records.MessageResponse;
import app.security.SignedUserDetails;
import app.services.DashboardSectionService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/dashboard/{dashboardId}/sections")
public class DashboardSectionController {
    private final DashboardSectionService dashboardSectionService;

    public DashboardSectionController(DashboardSectionService dashboardSectionService) {
        this.dashboardSectionService = dashboardSectionService;
    }

    @GetMapping
    public ResponseEntity<List<DashboardSectionResponseDto>> getDashboardSections(
            @PathVariable Long dashboardId,
            @AuthenticationPrincipal SignedUserDetails currentUser
    ) {
        return ResponseEntity.ok(
                dashboardSectionService.getDashboardSections(dashboardId, currentUser)
        );
    }

    @GetMapping("/{sectionId}")
    public ResponseEntity<DashboardSectionDetailResponseDto> getDashboardSection(
            @PathVariable Long dashboardId,
            @PathVariable Long sectionId,
            @AuthenticationPrincipal SignedUserDetails currentUser
    ) {
        return ResponseEntity.ok(
                dashboardSectionService.getDashboardSection(dashboardId, sectionId, currentUser)
        );
    }

    @PostMapping
    public ResponseEntity<DashboardSectionCreateResponseDto> createDashboardSection(
            @PathVariable Long dashboardId,
            @RequestBody @Valid DashboardSectionCreateDto dto,
            @AuthenticationPrincipal SignedUserDetails currentUser
    ) {
        return ResponseEntity.ok(
                dashboardSectionService.createDashboardSection(dashboardId, dto, currentUser)
        );
    }

    @PutMapping("/order")
    public ResponseEntity<List<DashboardSectionResponseDto>> reorderDashboardSections(
            @PathVariable Long dashboardId,
            @RequestBody @Valid DashboardSectionOrderDto dto,
            @AuthenticationPrincipal SignedUserDetails currentUser
    ) {
        return ResponseEntity.ok(
                dashboardSectionService.reorderDashboardSections(dashboardId, dto, currentUser)
        );
    }

    @PutMapping("/{sectionId}")
    public ResponseEntity<DashboardSectionCreateResponseDto> updateDashboardSection(
            @PathVariable Long dashboardId,
            @PathVariable Long sectionId,
            @RequestBody @Valid DashboardSectionCreateDto dto,
            @AuthenticationPrincipal SignedUserDetails currentUser
    ) {
        return ResponseEntity.ok(
                dashboardSectionService.updateDashboardSection(dashboardId, sectionId, dto, currentUser)
        );
    }

    @DeleteMapping("/{sectionId}")
    public ResponseEntity<MessageResponse> deleteDashboardSection(
            @PathVariable Long dashboardId,
            @PathVariable Long sectionId,
            @AuthenticationPrincipal SignedUserDetails currentUser
    ) {
        return ResponseEntity.ok(
                dashboardSectionService.deleteDashboardSection(dashboardId, sectionId, currentUser)
        );
    }
}
