package app.dtos.device;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

public record DeviceResponse(
        @Schema(example = "1")
        Long id,

        @Schema(example = "192.168.1.1")
        String ip,

        @Schema(example = "router1")
        String hostname,

        @Schema(example = "Cisco")
        String vendor,

        @Schema(example = "Catalyst 9000")
        String model,

        @Schema(example = "admin")
        String username,

        @Schema(example = "password")
        String password,

        @Schema(example = "443")
        Integer port,
        
        @Schema(example = "false")
        Boolean https,

        @Schema(example = "2026-05-19T00:00:00Z")
        Instant createdAt) {
}
