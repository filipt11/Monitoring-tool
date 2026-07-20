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
public class InterfaceGroup {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "interfaceGroupGen")
    @SequenceGenerator(name = "interfaceGroupGen", sequenceName = "interface_group_seq", allocationSize = 1)
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
            name = "interface_group_interfaces",
            joinColumns = @JoinColumn(name = "interface_group_id"),
            inverseJoinColumns = @JoinColumn(name = "interface_id")
    )
    private Set<DeviceInterface> interfaces = new HashSet<>();
}
