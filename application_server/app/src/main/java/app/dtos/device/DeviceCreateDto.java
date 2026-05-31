package app.dtos.device;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;

public record DeviceCreateDto(
        @Schema(example = "172.56.34.2")
        @NotBlank(message = "IP cannot be empty")
        @Size(min = 7, max = 15, message = "IP must be between 7 and 15 characters")
        String ip,

        @Schema(example = "cisco")
        @NotBlank(message = "Vendor cannot be empty")
        String vendor,

        @Schema(example = "admin")
        @NotBlank(message = "Username cannot be empty")
        String username,

        @Schema(example = "password123")
        @NotBlank(message = "Password cannot be empty")
        String password,

        @Schema(example = "443")
        @NotNull(message = "Port cannot be null")
        @Positive(message = "Port must be a positive number")
        Integer port,

        @NotNull(message = "HTTPS cannot be null")
        @Schema(example = "true")
        boolean https) {
}
