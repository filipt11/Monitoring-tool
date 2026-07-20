package app.repositories;

import app.entities.DeviceInterface;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface DeviceInterfaceRepository extends JpaRepository<DeviceInterface, Long> {
    List<DeviceInterface> findByDeviceIdOrderByIfIndexAsc(Long deviceId);

    @Query("SELECT i FROM InterfaceGroup ig JOIN ig.interfaces i WHERE ig.id = :groupId")
    Page<DeviceInterface> findByInterfaceGroupId(@Param("groupId") Long groupId, Pageable pageable);
}
