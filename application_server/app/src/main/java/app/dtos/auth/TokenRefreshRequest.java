package app.dtos.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

public record TokenRefreshRequest(
        @NotBlank(message = "Token cannot be empty")
        @Schema(example = "06211de1-9020-4869-814a-cfb336f09007")
        String refreshToken) {
}
