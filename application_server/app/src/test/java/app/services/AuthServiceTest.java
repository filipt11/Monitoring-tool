package app.services;

import app.dtos.auth.JwtResponse;
import app.dtos.auth.RegistrationResponse;
import app.dtos.auth.TokenRefreshRequest;
import app.dtos.auth.TokenRefreshResponse;
import app.dtos.myUser.MyUserLoginDto;
import app.dtos.myUser.MyUserRegisterDto;
import app.dtos.myUser.MyUserResponseDto;
import app.entities.MyUser;
import app.entities.RefreshToken;
import app.exceptions.*;
import app.mappers.MyUserMapper;
import app.repositories.MyUserRepository;
import app.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private MyUserRepository myUserRepository;

    @Mock
    private MyUserMapper myUserMapper;

    @Mock
    private JwtUtil jwtUtils;

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private RefreshTokenService refreshTokenService;

    @Mock
    private Authentication authentication;

    @InjectMocks
    private AuthService authService;

    private MyUserRegisterDto validRegisterDto;
    private MyUser user;
    private MyUserResponseDto userResponseDto;

    @BeforeEach
    void setUp() {
        validRegisterDto = new MyUserRegisterDto(
                "testuser",
                "test@example.com",
                "PaS$word1234",
                "PaS$word1234"
        );

        user = new MyUser();
        user.setId(1L);
        user.setUsername("testuser");
        user.setEmail("test@example.com");
        user.setRole("ROLE_USER");
        user.setBanned(false);

        userResponseDto = new MyUserResponseDto(1L, "testuser", "test@example.com", "ROLE_USER", false);
    }

    @Test
    void saveUser_shouldSaveAndReturnUser_whenDataIsValid() {
        when(myUserRepository.existsByUsername("testuser")).thenReturn(false);
        when(myUserRepository.existsByEmail("test@example.com")).thenReturn(false);

        MyUser mappedUser = new MyUser();
        when(myUserMapper.toEntity(validRegisterDto)).thenReturn(mappedUser);
        when(passwordEncoder.encode("PaS$word1234")).thenReturn("encoded-password");
        when(myUserRepository.save(mappedUser)).thenReturn(user);
        when(myUserMapper.toResponseDto(user)).thenReturn(userResponseDto);

        MyUserResponseDto result = authService.saveUser(validRegisterDto);

        assertThat(result).isEqualTo(userResponseDto);

        ArgumentCaptor<MyUser> userCaptor = ArgumentCaptor.forClass(MyUser.class);
        verify(myUserRepository).save(userCaptor.capture());

        MyUser savedUser = userCaptor.getValue();
        assertThat(savedUser.getPassword()).isEqualTo("encoded-password");
        assertThat(savedUser.getRole()).isEqualTo("ROLE_USER");
        assertThat(savedUser.isBanned()).isFalse();
    }

    @Test
    void saveUser_shouldThrowUsernameTakenException_whenUsernameExists() {
        when(myUserRepository.existsByUsername("testuser")).thenReturn(true);

        assertThatThrownBy(() -> authService.saveUser(validRegisterDto))
                .isInstanceOf(UsernameTakenException.class);

        verify(myUserRepository, never()).save(any());
    }

    @Test
    void saveUser_shouldThrowEmailTakenException_whenEmailExists() {
        when(myUserRepository.existsByUsername("testuser")).thenReturn(false);
        when(myUserRepository.existsByEmail("test@example.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.saveUser(validRegisterDto))
                .isInstanceOf(EmailTakenException.class);

        verify(myUserRepository, never()).save(any());
    }

    @Test
    void saveUser_shouldThrowPasswordsNotMatchingException_whenPasswordsDiffer() {
        MyUserRegisterDto mismatchedDto = new MyUserRegisterDto(
                "testuser",
                "test@example.com",
                "PaS$word1234",
                "DifferentPass1!"
        );

        when(myUserRepository.existsByUsername("testuser")).thenReturn(false);
        when(myUserRepository.existsByEmail("test@example.com")).thenReturn(false);

        assertThatThrownBy(() -> authService.saveUser(mismatchedDto))
                .isInstanceOf(PasswordsNotMatchingException.class);

        verify(myUserRepository, never()).save(any());
    }

    @Test
    void returnToken_shouldRegisterUserAndReturnTokens() {
        when(myUserRepository.existsByUsername("testuser")).thenReturn(false);
        when(myUserRepository.existsByEmail("test@example.com")).thenReturn(false);

        MyUser mappedUser = new MyUser();
        when(myUserMapper.toEntity(validRegisterDto)).thenReturn(mappedUser);
        when(passwordEncoder.encode("PaS$word1234")).thenReturn("encoded-password");
        when(myUserRepository.save(mappedUser)).thenReturn(user);
        when(myUserMapper.toResponseDto(user)).thenReturn(userResponseDto);
        when(jwtUtils.generateToken("testuser")).thenReturn("access-token");

        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setToken("refresh-token");
        when(refreshTokenService.createRefreshToken(1L)).thenReturn(refreshToken);

        RegistrationResponse result = authService.returnToken(validRegisterDto);

        assertThat(result.accessToken()).isEqualTo("access-token");
        assertThat(result.refreshToken()).isEqualTo("refresh-token");
        assertThat(result.myUserResponseDto()).isEqualTo(userResponseDto);
    }

    @Test
    void login_shouldReturnJwtResponse_whenCredentialsAreValid() {
        MyUserLoginDto loginDto = new MyUserLoginDto("testuser", "PaS$word1234");
        UserDetails userDetails = User.withUsername("testuser")
                .password("encoded-password")
                .roles("USER")
                .build();

        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(authentication);
        when(authentication.getPrincipal()).thenReturn(userDetails);
        when(myUserRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
        when(jwtUtils.generateToken("testuser")).thenReturn("access-token");

        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setToken("refresh-token");
        when(refreshTokenService.createRefreshToken(1L)).thenReturn(refreshToken);

        JwtResponse result = authService.login(loginDto);

        assertThat(result.accessToken()).isEqualTo("access-token");
        assertThat(result.refreshToken()).isEqualTo("refresh-token");
        verify(authenticationManager).authenticate(any(UsernamePasswordAuthenticationToken.class));
    }

    @Test
    void login_shouldThrowUserNotFoundException_whenUserDoesNotExist() {
        MyUserLoginDto loginDto = new MyUserLoginDto("testuser", "PaS$word1234");

        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(authentication);
        when(myUserRepository.findByUsername("testuser")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(loginDto))
                .isInstanceOf(UserNotFoundException.class);
    }

    @Test
    void login_shouldThrowAccountDisabledException_whenUserIsBanned() {
        MyUserLoginDto loginDto = new MyUserLoginDto("testuser", "PaS$word1234");
        user.setBanned(true);

        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(authentication);
        when(myUserRepository.findByUsername("testuser")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.login(loginDto))
                .isInstanceOf(AccountDisabledException.class);
    }

    @Test
    void refreshTokens_shouldReturnNewTokens_whenRefreshTokenIsValid() {
        TokenRefreshRequest request = new TokenRefreshRequest("old-refresh-token");

        RefreshToken existingToken = new RefreshToken();
        existingToken.setMyUser(user);
        existingToken.setExpiryDate(Instant.now().plusSeconds(3600));

        RefreshToken rotatedToken = new RefreshToken();
        rotatedToken.setToken("new-refresh-token");

        when(refreshTokenService.findByToken("old-refresh-token")).thenReturn(Optional.of(existingToken));
        when(refreshTokenService.verifyExpiration(existingToken)).thenReturn(existingToken);
        when(jwtUtils.generateToken("testuser")).thenReturn("new-access-token");
        when(refreshTokenService.rotateRefreshToken(existingToken)).thenReturn(rotatedToken);

        TokenRefreshResponse result = authService.refreshTokens(request);

        assertThat(result.accessToken()).isEqualTo("new-access-token");
        assertThat(result.refreshToken()).isEqualTo("new-refresh-token");
        verify(refreshTokenService).verifyExpiration(existingToken);
        verify(refreshTokenService).rotateRefreshToken(existingToken);
    }

    @Test
    void refreshTokens_shouldThrowMissingRefreshTokenException_whenTokenNotFound() {
        TokenRefreshRequest request = new TokenRefreshRequest("missing-token");

        when(refreshTokenService.findByToken("missing-token")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.refreshTokens(request))
                .isInstanceOf(MissingRefreshTokenException.class);
    }
}
