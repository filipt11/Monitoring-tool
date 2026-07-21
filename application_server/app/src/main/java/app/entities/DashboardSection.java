package app.entities;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

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

    @Column(nullable = false)
    private Integer sortOrder = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DashboardSectionSourceType sourceType;

    @ElementCollection
    @CollectionTable(
            name = "dashboard_section_metrics",
            joinColumns = @JoinColumn(name = "section_id")
    )
    @Column(name = "metric")
    private List<String> metrics = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dashboard_id", nullable = false)
    private Dashboard dashboard;

    @ManyToMany
    @JoinTable(
            name = "dashboard_section_devices",
            joinColumns = @JoinColumn(name = "section_id"),
            inverseJoinColumns = @JoinColumn(name = "device_id")
    )
    private Set<Device> devices = new LinkedHashSet<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "device_group_id")
    private DeviceGroup deviceGroup;

    @ManyToMany
    @JoinTable(
            name = "dashboard_section_interfaces",
            joinColumns = @JoinColumn(name = "section_id"),
            inverseJoinColumns = @JoinColumn(name = "interface_id")
    )
    private Set<DeviceInterface> interfaces = new LinkedHashSet<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "interface_group_id")
    private InterfaceGroup interfaceGroup;
}
