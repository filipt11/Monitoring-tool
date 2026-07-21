package app.dtos.dashboardSection;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record DashboardSectionOrderDto(
        @NotEmpty List<Long> sectionIds
) {
}
