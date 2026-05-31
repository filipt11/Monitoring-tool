package app.repositories;

import app.entities.Device;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DeviceRepository extends JpaRepository<Device, Long> {
    Page<Device> findByHostnameStartingWithIgnoreCase(Pageable pageable, String s);

    Page<Device> findByIpStartingWithIgnoreCase(Pageable pageable, String s);
}
