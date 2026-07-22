package app.dtos.data;

import java.util.Map;

public record InterfaceMetricsSummaryDto(
        String deviceId,
        String ifIndex,
        Map<String, Double> values
) {
}
