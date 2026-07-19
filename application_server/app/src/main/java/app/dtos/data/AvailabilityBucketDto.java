package app.dtos.data;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

public record AvailabilityBucketDto(
        @Schema(description = "Start of the one-hour bucket")
        Instant timestamp,

        @Schema(description = "Hourly availability status", example = "up")
        String status) {
}
