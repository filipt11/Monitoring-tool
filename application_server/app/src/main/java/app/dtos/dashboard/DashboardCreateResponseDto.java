package app.dtos.dashboard;

import app.entities.DeviceGroupVisibility;

public record DashboardCreateResponseDto(
        Long id,
        String name,
        String description,
        DeviceGroupVisibility visibility,
        Long ownerId,
        String ownerUsername
) {
}
