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
public class DashboardSection {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sectionGen")
    @SequenceGenerator(name = "sectionGen", sequenceName = "dashboard_section_seq", allocationSize = 1)
    private Long id;
    private String name;
    private String graphType;
    private List<String> metrics;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dashboard_id", nullable = false)
    private Dashboard dashboard;

    @ManyToMany
    @JoinTable(
            name = "dashboard_section_devices",
            joinColumns = @JoinColumn(name = "section_id"),
            inverseJoinColumns = @JoinColumn(name = "device_id")
    )
    private List<Device> devices;

    @ManyToMany
    @JoinTable(
            name = "dashboard_section_device_groups",
            joinColumns = @JoinColumn(name = "section_id"),
            inverseJoinColumns = @JoinColumn(name = "device_group_id")
    )
    private List<DeviceGroup> deviceGroups;
}
