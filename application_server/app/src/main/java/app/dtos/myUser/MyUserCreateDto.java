package app.dtos.myUser;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record MyUserCreateDto(
        @Schema(example = "newUser")
        @NotBlank(message = "Username cannot be empty")
        @Size(min = 3, max = 30, message = "Username must be between 3 and 30 characters")
        String username,

        @Schema(example = "example.email@example.com")
        @NotBlank(message = "Email cannot be empty")
        @Email(message = "Email must be valid")
        String email,

        @Schema(example = "PaS$word1234")
        @NotBlank(message = "Password cannot be empty")
        @Pattern(regexp = "^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{12,}$", message = "Password must meet the requirements")
        String password,

        @Schema(example = "PaS$word1234")
        @NotBlank(message = "Password confirmation cannot be empty")
        String password2,

        @Schema(example = "user", description = "available: 'admin' OR 'user'")
        @NotBlank(message = "Role cannot be empty")
        @Pattern(regexp = "user|admin", message = "Role must be valid")
        String role) {
}
