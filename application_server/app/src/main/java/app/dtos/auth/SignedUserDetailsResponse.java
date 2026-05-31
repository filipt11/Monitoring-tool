package app.dtos.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.security.core.GrantedAuthority;

import java.util.Collection;

public record SignedUserDetailsResponse(
        @Schema(example = "10")
        Long id,

        @Schema(example = "current-username")
        String username,

        @Schema(example = "current-user-email")
        String email,

        @Schema(description = "possible roles: 'ROLE_ADMIN', 'ROLE_USER'")
        Collection<? extends GrantedAuthority> authorities,

        @Schema(example = "false")
        boolean isBanned) {
}
