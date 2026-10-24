package app.dtos.data;

import java.util.List;

public record AnomaliesResponseDto(
        String start,
        String end,
        String computeStart,
        String computeEnd,
        int defaultLookbackHours,
        int contextLookbackHours,
        List<AnomalyItemDto> items
) {
}
