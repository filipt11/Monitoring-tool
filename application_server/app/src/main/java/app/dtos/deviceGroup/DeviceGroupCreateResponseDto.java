package app.dtos.deviceGroup;

import app.entities.DeviceGroupVisibility;

public record DeviceGroupCreateResponseDto(
        Long id,
        String name,
        String description,
        DeviceGroupVisibility visibility,
        Long ownerId,
        String ownerUsername
) {
}
