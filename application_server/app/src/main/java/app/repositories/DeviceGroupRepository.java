package app.repositories;

import app.entities.DeviceGroup;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DeviceGroupRepository extends JpaRepository<DeviceGroup, Long> {

    @EntityGraph(attributePaths = "owner")
    @Query("SELECT dg FROM DeviceGroup dg WHERE dg.id = :id")
    Optional<DeviceGroup> findByIdWithOwner(@Param("id") Long id);

    @EntityGraph(attributePaths = "owner")
    @Query("SELECT dg FROM DeviceGroup dg WHERE dg.id IN :ids")
    List<DeviceGroup> findAllWithOwnerByIdIn(@Param("ids") Collection<Long> ids);

    @Query("SELECT dg.id, SIZE(dg.devices) FROM DeviceGroup dg WHERE dg.id IN :ids")
    List<Object[]> countDevicesByGroupIds(@Param("ids") Collection<Long> ids);

    @EntityGraph(attributePaths = {"owner", "devices"})
    @Query("SELECT dg FROM DeviceGroup dg WHERE dg.id = :id")
    Optional<DeviceGroup> findByIdWithOwnerAndDevices(@Param("id") Long id);

    @EntityGraph(attributePaths = "devices")
    @Query("SELECT dg FROM DeviceGroup dg WHERE dg.id = :id")
    Optional<DeviceGroup> findByIdWithDevices(@Param("id") Long id);

    @Query("""
            SELECT dg FROM DeviceGroup dg
            WHERE dg.visibility = 'PUBLIC'
               OR (dg.visibility = 'PRIVATE' AND dg.owner.id = :userId)
            """)
    Page<DeviceGroup> findVisibleToUser(@Param("userId") Long userId, Pageable pageable);
}
