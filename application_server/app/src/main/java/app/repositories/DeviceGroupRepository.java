package app.repositories;

import app.entities.DeviceGroup;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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

    @Query(value = """
            SELECT dgd.device_group_id, COUNT(d.id)
            FROM device_group_devices dgd
            INNER JOIN devices d ON d.id = dgd.device_id
            WHERE dgd.device_group_id IN (:ids)
            GROUP BY dgd.device_group_id
            """, nativeQuery = true)
    List<Object[]> countDevicesByGroupIds(@Param("ids") Collection<Long> ids);

    @Modifying(clearAutomatically = true)
    @Query(value = """
            DELETE FROM device_group_devices dgd
            WHERE NOT EXISTS (
                SELECT 1 FROM devices d WHERE d.id = dgd.device_id
            )
            """, nativeQuery = true)
    void removeOrphanedDeviceGroupMemberships();

    @Modifying(clearAutomatically = true)
    @Query(value = "DELETE FROM device_group_devices WHERE device_id = :deviceId", nativeQuery = true)
    void removeDeviceFromAllGroups(@Param("deviceId") Long deviceId);

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
