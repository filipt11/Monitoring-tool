package app.controllers;

import app.dtos.myUser.*;
import app.records.MessageResponse;
import app.services.MyUserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import static org.springframework.http.HttpStatus.CREATED;

@RestController
public class MyUserController {
    private final MyUserService myUserService;

    public MyUserController(MyUserService myUserService) {
        this.myUserService = myUserService;
    }

    @PostMapping("/administration/api/users")
    public ResponseEntity<MyUserResponseDto> createUser(@RequestBody @Valid MyUserCreateDto myUserCreateDto) {
        MyUserResponseDto responseDto = myUserService.createUser(myUserCreateDto);
        return ResponseEntity.status(CREATED).body(responseDto);
    }

    @GetMapping("/administration/api/users/{id}")
    public ResponseEntity<MyUserResponseDto> selectUser(@PathVariable Long id) {
        MyUserResponseDto responseDto = myUserService.findUser(id);
        return ResponseEntity.ok(responseDto);
    }

    @PreAuthorize("#id.equals(authentication.principal.id) or hasRole('ADMIN')")
    @PatchMapping("/api/users/update/email/{id}")
    public ResponseEntity<MyUserResponseDto> updateUserEmail(@PathVariable Long id, @RequestBody @Valid MyUserEmailUpdateDto dto) {
        MyUserResponseDto responseDto = myUserService.editUserEmail(id, dto);
        return ResponseEntity.ok(responseDto);
    }

    @PatchMapping("/administration/users/update/password/{id}")
    public ResponseEntity<MyUserResponseDto> updateUserPasswordByAdmin(@PathVariable Long id, @RequestBody @Valid MyUserUpdatePasswordByAdminDto dto) {
        MyUserResponseDto responseDto = myUserService.updatePasswordByAdmin(id, dto);
        return ResponseEntity.ok(responseDto);
    }

    @PreAuthorize("#id.equals(authentication.principal.id) or hasRole('ADMIN')")
    @PutMapping("/api/users/update/password/{id}")
    public ResponseEntity<MyUserResponseDto> updateUserPasswordByUser(@PathVariable Long id, @RequestBody @Valid MyUserUpdatePasswordByUserDto dto) {
        MyUserResponseDto responseDto = myUserService.updatePasswordByUser(id, dto);
        return ResponseEntity.ok(responseDto);
    }


    @PreAuthorize("#id.equals(authentication.principal.id) or hasRole('ADMIN')")
    @DeleteMapping("/api/users/{id}")
    public ResponseEntity<MessageResponse> deleteUser(@PathVariable Long id) {
        myUserService.deleteUser(id);
        return ResponseEntity.ok(new MessageResponse("User has been deleted"));
    }

    @Operation()
    @ApiResponse(
            responseCode = "200",
            content = @Content(
                    mediaType = "application/json",
                    examples = @ExampleObject(
                            value = """
                                    {
                                      "content": [
                                        {
                                          "username": "testuser",
                                          "email": "test@example.com",
                                          "role": "ROLE_USER",
                                          "banned": false
                                        }
                                      ],
                                      "page": {
                                        "size": 10,
                                        "number": 0,
                                        "totalElements": 1,
                                        "totalPages": 1
                                      }
                                    }
                                    """
                    )
            )
    )
    @GetMapping("/administration/api/users")
    public ResponseEntity<Page<MyUserResponseDto>> selectAllUsers(@ParameterObject Pageable pageable) {
        Page<MyUserResponseDto> result = myUserService.selectUsers(pageable);
        return ResponseEntity.ok(result);
    }

    @Operation()
    @ApiResponse(
            responseCode = "200",
            content = @Content(
                    mediaType = "application/json",
                    examples = @ExampleObject(
                            value = """
                                    {
                                      "content": [
                                        {
                                            "username": "testuser",
                                            "email": "test@example.com",
                                            "role": "ROLE_USER",
                                            "banned": false
                                        }
                                      ],
                                      "page": {
                                        "size": 10,
                                        "number": 0,
                                        "totalElements": 1,
                                        "totalPages": 1
                                      }
                                    }
                                    """
                    )
            )
    )
    @GetMapping("/administration/api/users/search")
    public ResponseEntity<Page<MyUserResponseDto>> selectUsersByUsername(@ParameterObject Pageable pageable, @RequestParam String username) {
        Page<MyUserResponseDto> result = myUserService.findUsersByUsername(username, pageable);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/administration/api/user/disable/{id}")
    public ResponseEntity<MyUserResponseDto> disableUser(@PathVariable Long id) {
        return ResponseEntity.ok(myUserService.disableUser(id));
    }

    @PostMapping("/administration/api/user/enable/{id}")
    public ResponseEntity<MyUserResponseDto> enableUser(@PathVariable Long id) {
        return ResponseEntity.ok(myUserService.enableUser(id));
    }
}
