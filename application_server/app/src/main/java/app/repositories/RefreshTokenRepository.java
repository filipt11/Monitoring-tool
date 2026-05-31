package app.repositories;

import app.entities.MyUser;
import app.entities.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

import java.util.List;
import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    Optional<RefreshToken> findByToken(String token);

    List<RefreshToken> findByMyUser(MyUser myUser);

    @Modifying
    int deleteByMyUser(MyUser myUser);
}
