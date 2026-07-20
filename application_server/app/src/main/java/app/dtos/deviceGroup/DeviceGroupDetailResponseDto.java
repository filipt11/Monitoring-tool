package app.dtos.deviceGroup;

import app.dtos.device.DeviceNoCredentialsResponse;
import app.entities.DeviceGroupVisibility;
import org.springframework.data.domain.Page;

public record DeviceGroupDetailResponseDto(
        Long id,
        String name,
        String description,
        DeviceGroupVisibility visibility,
        Long ownerId,
        String ownerUsername,
        Page<DeviceNoCredentialsResponse> devices
) {
}
