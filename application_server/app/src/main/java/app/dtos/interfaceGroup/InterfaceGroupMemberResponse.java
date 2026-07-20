package app.dtos.interfaceGroup;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

public record InterfaceGroupMemberResponse(
        @Schema(example = "1")
        Long id,

        @Schema(example = "2")
        Long deviceId,

        @Schema(example = "r-avg-1")
        String deviceHostname,

        @Schema(example = "127.0.0.1")
        String deviceIp,

        @Schema(example = "GigabitEthernet1/0/2")
        String name,

        @Schema(example = "21")
        Integer ifIndex,

        @Schema(example = "00:60:5a:bf:19:c4")
        String mac,

        @Schema(example = "1000000000")
        Long speedBps,

        @Schema(example = "up")
        String adminStatus,

        @Schema(example = "up")
        String operStatus,

        @Schema(example = "2026-07-20T15:34:55.793661Z")
        Instant discoveredAt,

        @Schema(example = "2026-07-20T15:34:55.793661Z")
        Instant lastSeenAt
) {
}
