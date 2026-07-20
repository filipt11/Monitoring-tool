package app.dtos.interfaceGroup;

import app.entities.DeviceGroupVisibility;
import org.springframework.data.domain.Page;

public record InterfaceGroupDetailResponseDto(
        Long id,
        String name,
        String description,
        DeviceGroupVisibility visibility,
        Long ownerId,
        String ownerUsername,
        Page<InterfaceGroupMemberResponse> interfaces
) {
}
