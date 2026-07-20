package app.repositories;

import app.entities.Device;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DeviceRepository extends JpaRepository<Device, Long> {
    Page<Device> findByHostnameStartingWithIgnoreCase(Pageable pageable, String s);

    Page<Device> findByIpStartingWithIgnoreCase(Pageable pageable, String s);

    @Query("SELECT d FROM Device d JOIN d.deviceGroups dg WHERE dg.id = :groupId")
    Page<Device> findByDeviceGroupId(@Param("groupId") Long groupId, Pageable pageable);
}
