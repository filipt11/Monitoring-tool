package app.controllers;

import app.dtos.auth.SignedUserDetailsResponse;
import app.security.SignedUserDetails;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class UserDetailsController {

    @GetMapping("api/me")
    public ResponseEntity<SignedUserDetailsResponse> getMyData(@AuthenticationPrincipal SignedUserDetails user) {

        return ResponseEntity.ok(new SignedUserDetailsResponse(user.getId(), user.getUsername(), user.getEmail(), user.getAuthorities(), user.isBanned()));
    }
}
