package app.dtos.myUser;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record MyUserUpdatePasswordByUserDto(
        @NotBlank(message = "Hasło nie może być puste")
        String currentPassword,

        @Schema(example = "PaS$word1234")
        @NotBlank(message = "Password cannot be empty")
        @Pattern(regexp = "^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{12,}$", message = "Password must meet the requirements")
        String newPassword,

        @Schema(example = "PaS$word1234")
        @NotBlank(message = "Password confirmation cannot be empty")
        String newPassword2) {
}
