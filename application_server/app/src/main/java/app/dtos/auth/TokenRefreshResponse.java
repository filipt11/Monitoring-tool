package app.dtos.auth;

import io.swagger.v3.oas.annotations.media.Schema;

public record TokenRefreshResponse(
        @Schema(example = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlhdCI6MTc3MjI3NDY2OCwiZXhwIjoxNzcyMjc1NTY4fQ.ijlRQY6YyBq0KN5HcFgoTuHgxbv_jwx1MI2tLaEEljc")
        String accessToken,

        @Schema(example = "06211de1-9020-4869-814a-cfb336f09007")
        String refreshToken) {
}
