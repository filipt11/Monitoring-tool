package app.dtos.myUser;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record MyUserEmailUpdateDto(
        @Schema(example = "example.email@example.com")
        @NotBlank(message = "Email cannot be empty")
        @Email(message = "Email must be valid")
        String email) {
}
