package app.entities;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.Subselect;

import java.time.Instant;
import java.util.List;

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
                https,
                created_at
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

    @Column(name = "created_at")
    private Instant createdAt;

    @ManyToMany(mappedBy = "devices")
    private List<DeviceGroup> deviceGroups;

    @ManyToMany(mappedBy = "devices")
    private List<DashboardSection> sections;
}
