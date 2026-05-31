package app.dtos.myUser;

import io.swagger.v3.oas.annotations.media.Schema;

public record MyUserResponseDto(
        @Schema(example = "10")
        Long id,

        @Schema(example = "newUser")
        String username,

        @Schema(example = "example.email@example.com")
        String email,

        @Schema(example = "ROLE_USER")
        String role,

        @Schema(example = "false")
        boolean isBanned) {
}
