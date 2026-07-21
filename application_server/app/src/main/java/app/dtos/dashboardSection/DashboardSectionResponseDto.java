package app.dtos.dashboardSection;

import app.entities.DashboardSectionSourceType;

import java.util.List;

public record DashboardSectionResponseDto(
        Long id,
        Long dashboardId,
        String name,
        String graphType,
        List<String> metrics,
        DashboardSectionSourceType sourceType,
        int sourceItemCount,
        int sortOrder
) {
}
