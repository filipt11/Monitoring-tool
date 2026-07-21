package app.repositories;

import app.entities.DashboardSection;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DashboardSectionRepository extends JpaRepository<DashboardSection, Long> {

    List<DashboardSection> findByDashboardIdOrderByNameAsc(Long dashboardId);

    long countByDashboardId(Long dashboardId);

    @Query("SELECT s FROM DashboardSection s WHERE s.dashboard.id = :dashboardId ORDER BY s.sortOrder ASC, s.id ASC")
    List<DashboardSection> findAllByDashboardId(@Param("dashboardId") Long dashboardId);

    @EntityGraph(attributePaths = {"devices", "deviceGroup", "interfaces", "interfaceGroup"})
    @Query("SELECT s FROM DashboardSection s WHERE s.dashboard.id = :dashboardId ORDER BY s.sortOrder ASC, s.id ASC")
    List<DashboardSection> findByDashboardIdWithRelations(@Param("dashboardId") Long dashboardId);

    @EntityGraph(attributePaths = {
            "dashboard",
            "devices",
            "deviceGroup",
            "interfaces",
            "interfaceGroup"
    })
    @Query("SELECT s FROM DashboardSection s WHERE s.id = :id AND s.dashboard.id = :dashboardId")
    Optional<DashboardSection> findByIdAndDashboardIdWithRelations(
            @Param("id") Long id,
            @Param("dashboardId") Long dashboardId
    );
}
