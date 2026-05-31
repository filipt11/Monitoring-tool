package app;

import app.entities.MyUser;
import app.repositories.MyUserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;


@Component
public class DataLoader implements CommandLineRunner {
    private final MyUserRepository myUserRepository;
    private final PasswordEncoder passwordEncoder;
    
    public DataLoader(MyUserRepository myUserRepository, PasswordEncoder passwordEncoder) {
        this.myUserRepository = myUserRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) throws Exception {
        MyUser admin = createUserIfNotExists("admin", "admin@example.com", "123", "ROLE_ADMIN");

        MyUser testuser = createUserIfNotExists("testuser", "test.email@example.com", "123", "ROLE_USER");

    }

    private MyUser createUserIfNotExists(String username, String email, String password, String role) {
        MyUser user = myUserRepository.findByUsername(username).orElse(null);

        if (user == null) {
            user = new MyUser();
            user.setUsername(username);
            user.setEmail(email);
            user.setPassword(passwordEncoder.encode(password));
            user.setRole(role);
            myUserRepository.save(user);
            System.out.println("Created user: " + username);
        } else {
            System.out.println("User already exists: " + username);
        }
        return user;
    }
}
