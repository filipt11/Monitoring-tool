package app.repositories;

import app.entities.MyUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MyUserRepository extends JpaRepository<MyUser, Long> {
    Optional<MyUser> findByUsername(String username);

    Optional<MyUser> findByEmail(String email);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);
}
