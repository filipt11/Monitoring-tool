package app.dtos.data;

import java.util.Map;

public record DeviceMetricsSummaryDto(
        String deviceId,
        Map<String, Double> values
) {
}
