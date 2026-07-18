package app.dtos.data;

import java.util.List;

public record InterfaceMetricsDto(
        String deviceId,
        String ifIndex,
        List<DataPointDto> dataPoints
) {
}
