package app.services;

import app.dtos.myUser.MyUserCreateDto;
import app.dtos.myUser.MyUserEmailUpdateDto;
import app.dtos.myUser.MyUserResponseDto;
import app.dtos.myUser.MyUserUpdatePasswordByAdminDto;
import app.dtos.myUser.MyUserUpdatePasswordByUserDto;
import app.entities.MyUser;
import app.exceptions.EmailTakenException;
import app.exceptions.IllegalOperationException;
import app.exceptions.IncorrectPasswordException;
import app.exceptions.PasswordsNotMatchingException;
import app.exceptions.UserNotFoundException;
import app.exceptions.UsernameTakenException;
import app.mappers.MyUserMapper;
import app.repositories.MyUserRepository;
import app.repositories.RefreshTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MyUserServiceTest {

    @Mock
    private MyUserRepository myUserRepository;

    @Mock
    private MyUserMapper myUserMapper;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @InjectMocks
    private MyUserService myUserService;

    private MyUser user;
    private MyUserResponseDto userResponseDto;

    @BeforeEach
    void setUp() {
        user = new MyUser();
        user.setId(1L);
        user.setUsername("testuser");
        user.setEmail("test@example.com");
        user.setPassword("encoded-password");
        user.setRole("ROLE_USER");
        user.setBanned(false);

        userResponseDto = new MyUserResponseDto(1L, "testuser", "test@example.com", "ROLE_USER", false);
    }

    @Test
    void createUser_shouldCreateUserWithUserRole_whenRoleIsUser() {
        MyUserCreateDto dto = new MyUserCreateDto(
                "newuser",
                "new@example.com",
                "PaS$word1234",
                "PaS$word1234",
                "user"
        );

        when(myUserRepository.existsByUsername("newuser")).thenReturn(false);
        when(myUserRepository.existsByEmail("new@example.com")).thenReturn(false);
        when(passwordEncoder.encode("PaS$word1234")).thenReturn("encoded-new-password");
        when(myUserMapper.toResponseDto(any(MyUser.class))).thenReturn(userResponseDto);

        MyUserResponseDto result = myUserService.createUser(dto);

        assertThat(result).isEqualTo(userResponseDto);

        ArgumentCaptor<MyUser> userCaptor = ArgumentCaptor.forClass(MyUser.class);
        verify(myUserRepository).save(userCaptor.capture());

        MyUser savedUser = userCaptor.getValue();
        assertThat(savedUser.getUsername()).isEqualTo("newuser");
        assertThat(savedUser.getEmail()).isEqualTo("new@example.com");
        assertThat(savedUser.getPassword()).isEqualTo("encoded-new-password");
        assertThat(savedUser.getRole()).isEqualTo("ROLE_USER");
        assertThat(savedUser.isBanned()).isFalse();
    }

    @Test
    void createUser_shouldCreateUserWithAdminRole_whenRoleIsAdmin() {
        MyUserCreateDto dto = new MyUserCreateDto(
                "newadmin",
                "admin@example.com",
                "PaS$word1234",
                "PaS$word1234",
                "admin"
        );

        when(myUserRepository.existsByUsername("newadmin")).thenReturn(false);
        when(myUserRepository.existsByEmail("admin@example.com")).thenReturn(false);
        when(passwordEncoder.encode("PaS$word1234")).thenReturn("encoded-admin-password");
        when(myUserMapper.toResponseDto(any(MyUser.class))).thenReturn(userResponseDto);

        myUserService.createUser(dto);

        ArgumentCaptor<MyUser> userCaptor = ArgumentCaptor.forClass(MyUser.class);
        verify(myUserRepository).save(userCaptor.capture());
        assertThat(userCaptor.getValue().getRole()).isEqualTo("ROLE_ADMIN");
    }

    @Test
    void createUser_shouldThrowUsernameTakenException_whenUsernameExists() {
        MyUserCreateDto dto = new MyUserCreateDto(
                "existing",
                "new@example.com",
                "PaS$word1234",
                "PaS$word1234",
                "user"
        );

        when(myUserRepository.existsByUsername("existing")).thenReturn(true);

        assertThatThrownBy(() -> myUserService.createUser(dto))
                .isInstanceOf(UsernameTakenException.class);

        verify(myUserRepository, never()).save(any());
    }

    @Test
    void createUser_shouldThrowEmailTakenException_whenEmailExists() {
        MyUserCreateDto dto = new MyUserCreateDto(
                "newuser",
                "existing@example.com",
                "PaS$word1234",
                "PaS$word1234",
                "user"
        );

        when(myUserRepository.existsByUsername("newuser")).thenReturn(false);
        when(myUserRepository.existsByEmail("existing@example.com")).thenReturn(true);

        assertThatThrownBy(() -> myUserService.createUser(dto))
                .isInstanceOf(EmailTakenException.class);
    }

    @Test
    void createUser_shouldThrowPasswordsNotMatchingException_whenPasswordsDiffer() {
        MyUserCreateDto dto = new MyUserCreateDto(
                "newuser",
                "new@example.com",
                "PaS$word1234",
                "DifferentPass1!",
                "user"
        );

        when(myUserRepository.existsByUsername("newuser")).thenReturn(false);
        when(myUserRepository.existsByEmail("new@example.com")).thenReturn(false);

        assertThatThrownBy(() -> myUserService.createUser(dto))
                .isInstanceOf(PasswordsNotMatchingException.class);
    }

    @Test
    void createUser_shouldThrowBadRequest_whenRoleIsInvalid() {
        MyUserCreateDto dto = new MyUserCreateDto(
                "newuser",
                "new@example.com",
                "PaS$word1234",
                "PaS$word1234",
                "superadmin"
        );

        when(myUserRepository.existsByUsername("newuser")).thenReturn(false);
        when(myUserRepository.existsByEmail("new@example.com")).thenReturn(false);

        assertThatThrownBy(() -> myUserService.createUser(dto))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void findUser_shouldReturnUser_whenUserExists() {
        when(myUserRepository.findById(1L)).thenReturn(Optional.of(user));
        when(myUserMapper.toResponseDto(user)).thenReturn(userResponseDto);

        MyUserResponseDto result = myUserService.findUser(1L);

        assertThat(result).isEqualTo(userResponseDto);
    }

    @Test
    void findUser_shouldThrowUserNotFoundException_whenUserDoesNotExist() {
        when(myUserRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> myUserService.findUser(99L))
                .isInstanceOf(UserNotFoundException.class);
    }

    @Test
    void editUserEmail_shouldUpdateEmail_whenNewEmailIsAvailable() {
        MyUserEmailUpdateDto dto = new MyUserEmailUpdateDto("updated@example.com");

        when(myUserRepository.findById(1L)).thenReturn(Optional.of(user));
        when(myUserRepository.existsByEmail("updated@example.com")).thenReturn(false);
        when(myUserMapper.toResponseDto(user)).thenReturn(userResponseDto);

        MyUserResponseDto result = myUserService.editUserEmail(1L, dto);

        assertThat(result).isEqualTo(userResponseDto);
        assertThat(user.getEmail()).isEqualTo("updated@example.com");
    }

    @Test
    void editUserEmail_shouldSkipDuplicateCheck_whenEmailUnchanged() {
        MyUserEmailUpdateDto dto = new MyUserEmailUpdateDto("test@example.com");

        when(myUserRepository.findById(1L)).thenReturn(Optional.of(user));
        when(myUserMapper.toResponseDto(user)).thenReturn(userResponseDto);

        myUserService.editUserEmail(1L, dto);

        verify(myUserRepository, never()).existsByEmail(any());
    }

    @Test
    void editUserEmail_shouldThrowEmailTakenException_whenEmailAlreadyExists() {
        MyUserEmailUpdateDto dto = new MyUserEmailUpdateDto("taken@example.com");

        when(myUserRepository.findById(1L)).thenReturn(Optional.of(user));
        when(myUserRepository.existsByEmail("taken@example.com")).thenReturn(true);

        assertThatThrownBy(() -> myUserService.editUserEmail(1L, dto))
                .isInstanceOf(EmailTakenException.class);
    }

    @Test
    void updatePasswordByAdmin_shouldUpdatePassword_whenUserExists() {
        MyUserUpdatePasswordByAdminDto dto = new MyUserUpdatePasswordByAdminDto("NewPaS$word1234");

        when(myUserRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("NewPaS$word1234")).thenReturn("new-encoded-password");
        when(myUserMapper.toResponseDto(user)).thenReturn(userResponseDto);

        MyUserResponseDto result = myUserService.updatePasswordByAdmin(1L, dto);

        assertThat(result).isEqualTo(userResponseDto);
        assertThat(user.getPassword()).isEqualTo("new-encoded-password");
    }

    @Test
    void updatePasswordByUser_shouldUpdatePassword_whenCurrentPasswordMatches() {
        MyUserUpdatePasswordByUserDto dto = new MyUserUpdatePasswordByUserDto(
                "OldPaS$word1234",
                "NewPaS$word1234",
                "NewPaS$word1234"
        );

        when(myUserRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("OldPaS$word1234", "encoded-password")).thenReturn(true);
        when(passwordEncoder.encode("NewPaS$word1234")).thenReturn("new-encoded-password");
        when(myUserMapper.toResponseDto(user)).thenReturn(userResponseDto);

        MyUserResponseDto result = myUserService.updatePasswordByUser(1L, dto);

        assertThat(result).isEqualTo(userResponseDto);
        assertThat(user.getPassword()).isEqualTo("new-encoded-password");
    }

    @Test
    void updatePasswordByUser_shouldThrowPasswordsNotMatchingException_whenNewPasswordsDiffer() {
        MyUserUpdatePasswordByUserDto dto = new MyUserUpdatePasswordByUserDto(
                "OldPaS$word1234",
                "NewPaS$word1234",
                "DifferentPass1!"
        );

        assertThatThrownBy(() -> myUserService.updatePasswordByUser(1L, dto))
                .isInstanceOf(PasswordsNotMatchingException.class);
    }

    @Test
    void updatePasswordByUser_shouldThrowIncorrectPasswordException_whenCurrentPasswordIsWrong() {
        MyUserUpdatePasswordByUserDto dto = new MyUserUpdatePasswordByUserDto(
                "WrongPaS$word12",
                "NewPaS$word1234",
                "NewPaS$word1234"
        );

        when(myUserRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("WrongPaS$word12", "encoded-password")).thenReturn(false);

        assertThatThrownBy(() -> myUserService.updatePasswordByUser(1L, dto))
                .isInstanceOf(IncorrectPasswordException.class);
    }

    @Test
    void deleteUser_shouldDeleteUserAndRefreshTokens_whenUserIsNotAdmin() {
        MyUser admin = new MyUser();
        admin.setId(99L);
        admin.setUsername("admin");

        when(myUserRepository.findById(1L)).thenReturn(Optional.of(user));
        when(myUserRepository.findByUsername("admin")).thenReturn(Optional.of(admin));

        myUserService.deleteUser(1L);

        verify(refreshTokenRepository).deleteByMyUser(user);
        verify(myUserRepository).delete(user);
    }

    @Test
    void deleteUser_shouldThrowIllegalOperationException_whenTryingToDeleteAdmin() {
        MyUser adminUser = new MyUser();
        adminUser.setId(99L);
        adminUser.setUsername("admin");

        when(myUserRepository.findById(99L)).thenReturn(Optional.of(adminUser));

        assertThatThrownBy(() -> myUserService.deleteUser(99L))
                .isInstanceOf(IllegalOperationException.class)
                .hasMessageContaining("Cannot delete admin");

        verify(myUserRepository, never()).delete(any());
    }

    @Test
    void selectUsers_shouldReturnMappedPage() {
        Pageable pageable = PageRequest.of(0, 10);
        Page<MyUser> page = new PageImpl<>(List.of(user), pageable, 1);

        when(myUserRepository.findAll(pageable)).thenReturn(page);
        when(myUserMapper.toDto(user)).thenReturn(userResponseDto);

        Page<MyUserResponseDto> result = myUserService.selectUsers(pageable);

        assertThat(result.getContent()).containsExactly(userResponseDto);
    }

    @Test
    void findUsersByUsername_shouldReturnMatchingUsers() {
        Pageable pageable = PageRequest.of(0, 10);
        Page<MyUser> page = new PageImpl<>(List.of(user), pageable, 1);

        when(myUserRepository.findByUsernameStartingWithIgnoreCase("test", pageable)).thenReturn(page);
        when(myUserMapper.toDto(user)).thenReturn(userResponseDto);

        Page<MyUserResponseDto> result = myUserService.findUsersByUsername("test", pageable);

        assertThat(result.getContent()).containsExactly(userResponseDto);
    }

    @Test
    void disableUser_shouldBanUserAndDeleteRefreshTokens() {
        when(myUserRepository.findById(1L)).thenReturn(Optional.of(user));
        when(myUserMapper.toDto(user)).thenReturn(userResponseDto);

        MyUserResponseDto result = myUserService.disableUser(1L);

        assertThat(result).isEqualTo(userResponseDto);
        assertThat(user.isBanned()).isTrue();
        verify(refreshTokenRepository).deleteByMyUser(user);
    }

    @Test
    void enableUser_shouldUnbanUser() {
        user.setBanned(true);
        when(myUserRepository.findById(1L)).thenReturn(Optional.of(user));
        when(myUserMapper.toDto(user)).thenReturn(userResponseDto);

        MyUserResponseDto result = myUserService.enableUser(1L);

        assertThat(result).isEqualTo(userResponseDto);
        assertThat(user.isBanned()).isFalse();
    }
}
