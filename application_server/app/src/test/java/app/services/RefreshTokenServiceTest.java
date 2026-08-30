package app.services;

import app.entities.MyUser;
import app.entities.RefreshToken;
import app.exceptions.UserNotFoundException;
import app.repositories.MyUserRepository;
import app.repositories.RefreshTokenRepository;
import org.apache.commons.codec.digest.DigestUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {

    private static final long REFRESH_TOKEN_DURATION_MS = 3_600_000L;

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @Mock
    private MyUserRepository myUserRepository;

    @InjectMocks
    private RefreshTokenService refreshTokenService;

    private MyUser user;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(refreshTokenService, "refreshTokenDurationMs", REFRESH_TOKEN_DURATION_MS);

        user = new MyUser();
        user.setId(1L);
        user.setUsername("testuser");
        user.setEmail("test@example.com");
    }

    @Test
    void createRefreshToken_shouldSaveHashedTokenAndReturnRawToken() {
        when(myUserRepository.findById(1L)).thenReturn(Optional.of(user));

        RefreshToken result = refreshTokenService.createRefreshToken(1L);

        assertThat(result.getToken()).isNotBlank();
        assertThat(result.getMyUser()).isSameAs(user);
        assertThat(result.getExpiryDate()).isAfter(Instant.now());

        ArgumentCaptor<RefreshToken> tokenCaptor = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository).save(tokenCaptor.capture());

        RefreshToken savedToken = tokenCaptor.getValue();
        assertThat(savedToken.getToken()).isEqualTo(DigestUtils.sha256Hex(result.getToken()));
        assertThat(savedToken.getToken()).isNotEqualTo(result.getToken());
        assertThat(savedToken.getMyUser()).isSameAs(user);
    }

    @Test
    void createRefreshToken_shouldThrowUserNotFoundException_whenUserDoesNotExist() {
        when(myUserRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> refreshTokenService.createRefreshToken(99L))
                .isInstanceOf(UserNotFoundException.class);

        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    void findByToken_shouldLookupHashedTokenInRepository() {
        String rawToken = "06211de1-9020-4869-814a-cfb336f09007";
        RefreshToken storedToken = refreshToken(1L, DigestUtils.sha256Hex(rawToken));

        when(refreshTokenRepository.findByToken(DigestUtils.sha256Hex(rawToken)))
                .thenReturn(Optional.of(storedToken));

        Optional<RefreshToken> result = refreshTokenService.findByToken(rawToken);

        assertThat(result).contains(storedToken);
        verify(refreshTokenRepository).findByToken(DigestUtils.sha256Hex(rawToken));
    }

    @Test
    void findByToken_shouldReturnEmpty_whenTokenDoesNotExist() {
        when(refreshTokenRepository.findByToken(any())).thenReturn(Optional.empty());

        Optional<RefreshToken> result = refreshTokenService.findByToken("missing-token");

        assertThat(result).isEmpty();
    }

    @Test
    void verifyExpiration_shouldReturnToken_whenTokenIsStillValid() {
        RefreshToken token = refreshToken(1L, "hashed-token");
        token.setExpiryDate(Instant.now().plusSeconds(3600));

        RefreshToken result = refreshTokenService.verifyExpiration(token);

        assertThat(result).isSameAs(token);
        verify(refreshTokenRepository, never()).delete(any());
    }

    @Test
    void verifyExpiration_shouldDeleteTokenAndThrow_whenTokenIsExpired() {
        RefreshToken token = refreshToken(1L, "hashed-token");
        token.setExpiryDate(Instant.now().minusSeconds(60));

        assertThatThrownBy(() -> refreshTokenService.verifyExpiration(token))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Refresh token has expired");

        verify(refreshTokenRepository).delete(token);
    }

    @Test
    void rotateRefreshToken_shouldDeleteOldTokenAndCreateNewOne() {
        RefreshToken oldToken = refreshToken(10L, "old-hashed-token");
        oldToken.setMyUser(user);

        when(myUserRepository.findById(1L)).thenReturn(Optional.of(user));

        RefreshToken result = refreshTokenService.rotateRefreshToken(oldToken);

        verify(refreshTokenRepository).delete(oldToken);
        verify(refreshTokenRepository).save(any(RefreshToken.class));
        assertThat(result.getToken()).isNotBlank();
        assertThat(result.getMyUser()).isSameAs(user);
    }

    @Test
    void deleteByUser_shouldDelegateToRepository() {
        refreshTokenService.deleteByUser(user);

        verify(refreshTokenRepository).deleteByMyUser(user);
    }

    private RefreshToken refreshToken(Long id, String token) {
        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setId(id);
        refreshToken.setToken(token);
        refreshToken.setMyUser(user);
        refreshToken.setExpiryDate(Instant.now().plusSeconds(3600));
        return refreshToken;
    }
}
