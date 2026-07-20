package app.entities;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.Subselect;

import java.time.Instant;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@ToString

@Entity
@Immutable
@Subselect("""
            SELECT
                id,
                device_id,
                name,
                if_index,
                mac,
                speed_bps,
                admin_status,
                oper_status,
                discovered_at,
                last_seen_at
            FROM interfaces
        """)
public class DeviceInterface {

    @Id
    private Long id;

    @Column(name = "device_id")
    private Long deviceId;

    private String name;

    @Column(name = "if_index")
    private Integer ifIndex;

    private String mac;

    @Column(name = "speed_bps")
    private Long speedBps;

    @Column(name = "admin_status")
    private String adminStatus;

    @Column(name = "oper_status")
    private String operStatus;

    @Column(name = "discovered_at")
    private Instant discoveredAt;

    @Column(name = "last_seen_at")
    private Instant lastSeenAt;
}
