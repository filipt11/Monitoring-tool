package app.entities;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.HashSet;
import java.util.Set;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor

@Entity
public class DeviceGroup {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "deviceGroupGen")
    @SequenceGenerator(name = "deviceGroupGen", sequenceName = "device_group_seq", allocationSize = 1)
    private Long id;
    private String name;
    private String description;

    @Enumerated(EnumType.STRING)
    private DeviceGroupVisibility visibility = DeviceGroupVisibility.PUBLIC;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private MyUser owner;

    @ManyToMany
    @JoinTable(
            name = "device_group_devices",
            joinColumns = @JoinColumn(name = "device_group_id"),
            inverseJoinColumns = @JoinColumn(name = "device_id")
    )
    private Set<Device> devices = new HashSet<>();

    @ManyToMany(mappedBy = "deviceGroups")
    private Set<DashboardSection> sections;
}
