package app.services;


import app.entities.MyUser;
import app.entities.RefreshToken;
import app.exceptions.UserNotFoundException;
import app.repositories.MyUserRepository;
import app.repositories.RefreshTokenRepository;
import org.apache.commons.codec.digest.DigestUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
public class RefreshTokenService {
    private final RefreshTokenRepository refreshTokenRepository;
    private final MyUserRepository myUserRepository;

    public RefreshTokenService(RefreshTokenRepository refreshTokenRepository, MyUserRepository myUserRepository) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.myUserRepository = myUserRepository;
    }

    @Value("${app.jwtRefreshExpirationMs}")
    private Long refreshTokenDurationMs;


    public RefreshToken createRefreshToken(Long userId) {
        MyUser user = myUserRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException());

        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setMyUser(user);
        refreshToken.setExpiryDate(Instant.now().plusMillis(refreshTokenDurationMs));

        String rawToken = UUID.randomUUID().toString();
        refreshToken.setToken(rawToken);

        RefreshToken returnToken = new RefreshToken();
        returnToken.setMyUser(user);
        returnToken.setExpiryDate(refreshToken.getExpiryDate());
        returnToken.setToken(rawToken);

        refreshToken.setToken(DigestUtils.sha256Hex(rawToken));
        refreshTokenRepository.save(refreshToken);

        return returnToken;
    }

    public Optional<RefreshToken> findByToken(String token) {
        String hashedToken = DigestUtils.sha256Hex(token);
        return refreshTokenRepository.findByToken(hashedToken);
    }

    public RefreshToken verifyExpiration(RefreshToken token) {
        if (token.getExpiryDate().isBefore(Instant.now())) {
            refreshTokenRepository.delete(token);
            throw new RuntimeException("Refresh token has expired. Please make a new login.");
        }
        return token;
    }

    public RefreshToken rotateRefreshToken(RefreshToken oldToken) {
        refreshTokenRepository.delete(oldToken);
        return createRefreshToken(oldToken.getMyUser().getId());
    }

    @Transactional
    public void deleteByUser(MyUser user) {
        refreshTokenRepository.deleteByMyUser(user);
    }

}
