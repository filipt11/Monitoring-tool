package app.dtos.dashboard;

import app.entities.DeviceGroupVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DashboardCreateDto(
        @Schema(description = "The name of the dashboard", example = "My Dashboard")
        @NotBlank
        @Size(min = 2, max = 30, message = "Name must be between 2 and 30 characters")
        String name,

        @Size(max = 200, message = "Description must have less than 200 characters")
        @Schema(description = "The description of the dashboard", example = "A simple dashboard")
        String description,

        @Schema(
                description = "Dashboard visibility. Admins may set PUBLIC (shared with all users) or ADMIN_ONLY. Regular users always create PRIVATE dashboards.",
                example = "PRIVATE"
        )
        DeviceGroupVisibility visibility
) {
}
