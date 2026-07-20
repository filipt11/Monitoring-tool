package app.dtos.interfaceGroup;

import app.entities.DeviceGroupVisibility;

public record InterfaceGroupCreateResponseDto(
        Long id,
        String name,
        String description,
        DeviceGroupVisibility visibility,
        Long ownerId,
        String ownerUsername
) {
}
