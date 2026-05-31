package app.entities;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.Subselect;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@ToString

@Entity
@Immutable
@Subselect("""
            SELECT
                id,
                ip,
                hostname,
                vendor,
                model,
                username,
                password,
                port,
                https
            FROM devices
        """)
public class Device {

    @Id
    private Long id;

    private String ip;
    private String hostname;
    private String vendor;
    private String model;
    private String username;
    private String password;
    private Integer port;
    private boolean https;
}
