package app.dtos.data;

import java.util.List;

public record DeviceAvailabilityDto(
        String deviceId,
        List<AvailabilityBucketDto> buckets) {
}
