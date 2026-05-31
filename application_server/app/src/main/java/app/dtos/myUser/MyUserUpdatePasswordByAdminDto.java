package app.dtos.myUser;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record MyUserUpdatePasswordByAdminDto(
        @Schema(example = "PaS$word1234")
        @NotBlank(message = "Password cannot be empty")
        @Pattern(regexp = "^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{12,}$", message = "Password must meet the requirements")
        String password) {
}
