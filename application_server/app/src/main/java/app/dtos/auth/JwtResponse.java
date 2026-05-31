package app.dtos.auth;

import io.swagger.v3.oas.annotations.media.Schema;

public record JwtResponse(
        @Schema(example = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbkB0ZXN0LmNvbSIsImlhdCI6MTYxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c")
        String accessToken,

        @Schema(example = "06211de1-9020-4869-814a-cfb336f09007")
        String refreshToken) {
}
