package app.entities;

import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString

@Entity
public class MyUser {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "usersGen")
    @SequenceGenerator(name = "usersGen", sequenceName = "users_seq", allocationSize = 1)
    private Long id;
    private String username;
    private String email;
    private String password;
    private String role;

    @Column(columnDefinition = "boolean default false")
    private boolean isBanned;
}
