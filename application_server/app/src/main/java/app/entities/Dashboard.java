package app.entities;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor

@Entity
public class Dashboard {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "dashboardGen")
    @SequenceGenerator(name = "dashboardGen", sequenceName = "dashboard_seq", allocationSize = 1)
    private Long id;
    private String name;
    private String description;

    @Enumerated(EnumType.STRING)
    private DeviceGroupVisibility visibility = DeviceGroupVisibility.PRIVATE;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private MyUser owner;

    @OneToMany(mappedBy = "dashboard", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DashboardSection> sections;
}
