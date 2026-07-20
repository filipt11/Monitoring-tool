package app.dtos.deviceGroup;

import app.entities.DeviceGroupVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DeviceGroupCreateDto(
        @Schema(example = "Group 1")
        @NotBlank(message = "Group name cannot be empty")
        @Size(min = 2, max = 30, message = "Group name must be between 2 and 30 characters")
        String name,

        @Schema(example = "Description for Group 1")
        @Size(max = 200, message = "Group description must have less than 200 characters")
        String description,

        @Schema(
                description = "Group visibility. Admins may set PUBLIC or ADMIN_ONLY. Regular users always create PRIVATE groups.",
                example = "PUBLIC"
        )
        DeviceGroupVisibility visibility
) {
}
