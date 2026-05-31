package app.dtos.device;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record DeviceUpdateDto(
        @Schema(example = "443")
        @NotNull(message = "Port cannot be null")
        @Positive(message = "Port must be a positive number")
        Integer port,

        @Schema(example = "true")
        @NotNull(message = "HTTPS cannot be null")
        Boolean https,

        @Schema(example = "admin")
        @NotBlank(message = "Username cannot be empty")
        String username,

        @Schema(example = "password123")
        @NotBlank(message = "Password cannot be empty")
        String password
) {
}
