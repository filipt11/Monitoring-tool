package app.dtos.dashboardSection;

import app.entities.DashboardSectionSourceType;

import java.util.List;

public record DashboardSectionDetailResponseDto(
        Long id,
        Long dashboardId,
        String name,
        String graphType,
        List<String> metrics,
        DashboardSectionSourceType sourceType,
        List<Long> deviceIds,
        Long deviceGroupId,
        List<Long> interfaceIds,
        Long interfaceGroupId,
        int sortOrder
) {
}
