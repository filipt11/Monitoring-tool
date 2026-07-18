package app.dtos.myUser;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

public record MyUserLoginDto(
        @Schema(example = "admin")
        @NotBlank(message = "Username cannot be empty")
        String username,

        @Schema(example = "123")
        @NotBlank(message = "Password cannot be empty")
        String password) {
}
