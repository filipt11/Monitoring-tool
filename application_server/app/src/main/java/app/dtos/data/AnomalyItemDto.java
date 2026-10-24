package app.dtos.data;

public record AnomalyItemDto(
        String detector,
        String scope,
        String metric,
        String hostname,
        String ifName,
        String startTime,
        String endTime,
        Double value,
        Double peakValue,
        int sampleCount,
        Double cusumSh,
        Double cusumSl
) {
}
