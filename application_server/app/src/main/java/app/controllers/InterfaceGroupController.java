package app.controllers;

import app.dtos.interfaceGroup.InterfaceGroupCreateDto;
import app.dtos.interfaceGroup.InterfaceGroupCreateResponseDto;
import app.dtos.interfaceGroup.InterfaceGroupDetailResponseDto;
import app.dtos.interfaceGroup.InterfaceGroupMemberResponse;
import app.dtos.interfaceGroup.InterfaceGroupResponseDto;
import app.records.MessageResponse;
import app.security.SignedUserDetails;
import app.services.InterfaceGroupService;
import jakarta.validation.Valid;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class InterfaceGroupController {
    private final InterfaceGroupService interfaceGroupService;

    public InterfaceGroupController(InterfaceGroupService interfaceGroupService) {
        this.interfaceGroupService = interfaceGroupService;
    }

    @GetMapping("/api/interface-group")
    public ResponseEntity<Page<InterfaceGroupResponseDto>> getInterfaceGroups(
            @ParameterObject @PageableDefault(size = 20, sort = "name", direction = Sort.Direction.ASC) Pageable pageable,
            @AuthenticationPrincipal SignedUserDetails currentUser
    ) {
        return ResponseEntity.ok(interfaceGroupService.getInterfaceGroups(pageable, currentUser));
    }

    @GetMapping("/api/interface-group/{id}")
    public ResponseEntity<InterfaceGroupDetailResponseDto> getInterfaceGroup(
            @PathVariable Long id,
            @ParameterObject @PageableDefault(size = 10, sort = "name", direction = Sort.Direction.ASC) Pageable interfacePageable,
            @AuthenticationPrincipal SignedUserDetails currentUser
    ) {
        return ResponseEntity.ok(interfaceGroupService.getInterfaceGroup(id, interfacePageable, currentUser));
    }

    @GetMapping("/api/interfaces")
    public ResponseEntity<Page<InterfaceGroupMemberResponse>> getInterfaceCatalog(
            @ParameterObject @PageableDefault(size = 1000, sort = "name", direction = Sort.Direction.ASC) Pageable pageable
    ) {
        return ResponseEntity.ok(interfaceGroupService.getInterfaceCatalog(pageable));
    }

    @PostMapping("/api/interface-group")
    public ResponseEntity<InterfaceGroupCreateResponseDto> createInterfaceGroup(
            @RequestBody @Valid InterfaceGroupCreateDto interfaceGroupCreateDto,
            @AuthenticationPrincipal SignedUserDetails currentUser
    ) {
        return ResponseEntity.ok(interfaceGroupService.createInterfaceGroup(interfaceGroupCreateDto, currentUser));
    }

    @PutMapping("/api/interface-group/{id}")
    public ResponseEntity<InterfaceGroupCreateResponseDto> updateInterfaceGroup(
            @PathVariable Long id,
            @RequestBody @Valid InterfaceGroupCreateDto interfaceGroupCreateDto,
            @AuthenticationPrincipal SignedUserDetails currentUser
    ) {
        return ResponseEntity.ok(interfaceGroupService.updateInterfaceGroup(id, interfaceGroupCreateDto, currentUser));
    }

    @PostMapping("/api/interface-group/{id}/add-interfaces")
    public ResponseEntity<InterfaceGroupResponseDto> addInterfacesToInterfaceGroup(
            @PathVariable Long id,
            @RequestBody List<Long> interfaceIds,
            @AuthenticationPrincipal SignedUserDetails currentUser
    ) {
        return ResponseEntity.ok(interfaceGroupService.addInterfacesToGroup(id, interfaceIds, currentUser));
    }

    @PostMapping("/api/interface-group/{id}/delete-interfaces")
    public ResponseEntity<InterfaceGroupResponseDto> deleteInterfacesFromInterfaceGroup(
            @PathVariable Long id,
            @RequestBody List<Long> interfaceIds,
            @AuthenticationPrincipal SignedUserDetails currentUser
    ) {
        return ResponseEntity.ok(interfaceGroupService.deleteInterfacesFromGroup(id, interfaceIds, currentUser));
    }

    @DeleteMapping("/api/interface-group/{id}")
    public ResponseEntity<MessageResponse> deleteInterfaceGroup(
            @PathVariable Long id,
            @AuthenticationPrincipal SignedUserDetails currentUser
    ) {
        return ResponseEntity.ok(interfaceGroupService.deleteInterfaceGroup(id, currentUser));
    }
}
