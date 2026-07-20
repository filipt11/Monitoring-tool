package app.dtos.deviceGroup;

import app.entities.DashboardSection;
import app.entities.DeviceGroupVisibility;

import java.util.List;

public record DeviceGroupResponseDto(
        Long id,
        String name,
        String description,
        DeviceGroupVisibility visibility,
        Long ownerId,
        String ownerUsername,
        int deviceCount,
        List<DashboardSection> sections
) {
}
