package app.dtos.data;

import java.time.Instant;
import java.util.Map;

public record DataPointDto(
        Instant timestamp,
        Map<String, Double> values) {
}
