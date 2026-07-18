package app.dtos.data;

import java.util.List;

public record DeviceMetricsDto(
        String deviceId,
        List<DataPointDto> dataPoints
) {
}
