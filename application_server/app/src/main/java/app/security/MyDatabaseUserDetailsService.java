package app.security;

import app.Entity.MyUser;
import app.repositories.MyUserRepository;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MyDatabaseUserDetailsService implements UserDetailsService {
    private final MyUserRepository myUserRepository;

    public MyDatabaseUserDetailsService(MyUserRepository myUserRepository) {
        this.myUserRepository = myUserRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        MyUser user = myUserRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));

        if (user.isBanned()) {
            throw new LockedException("You account has been banned.");
        }

        List<GrantedAuthority> authorities =
                List.of(new SimpleGrantedAuthority(user.getRole()));

        return new SignedUserDetails(authorities, user.getPassword(), user.getEmail(), user.getUsername(), user.getId(), user.isBanned());

    }
}
