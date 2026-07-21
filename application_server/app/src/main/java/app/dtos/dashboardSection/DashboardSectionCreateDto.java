package app.dtos.dashboardSection;

import app.entities.DashboardSectionSourceType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record DashboardSectionCreateDto(
        @Schema(description = "Section display name", example = "CPU utilization")
        @NotBlank(message = "Section name cannot be empty")
        @Size(min = 2, max = 50, message = "Section name must be between 2 and 50 characters")
        String name,

        @Schema(description = "Chart type for this section", example = "line")
        @NotBlank(message = "Graph type cannot be empty")
        @Size(max = 30, message = "Graph type must have less than 30 characters")
        String graphType,

        @Schema(description = "Metric keys to display in this section", example = "[\"cpu_pct\", \"mem_pct\"]")
        List<String> metrics,

        @Schema(
                description = "What this section is plugged into. Exactly one source type must be selected.",
                example = "DEVICE_LIST"
        )
        @NotNull(message = "Source type is required")
        DashboardSectionSourceType sourceType,

        @Schema(description = "Required when sourceType is DEVICE_LIST")
        List<Long> deviceIds,

        @Schema(description = "Required when sourceType is DEVICE_GROUP")
        Long deviceGroupId,

        @Schema(description = "Required when sourceType is INTERFACE_LIST")
        List<Long> interfaceIds,

        @Schema(description = "Required when sourceType is INTERFACE_GROUP")
        Long interfaceGroupId
) {
}
