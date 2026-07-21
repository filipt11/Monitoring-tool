package app.repositories;

import app.entities.Dashboard;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DashboardRepository extends JpaRepository<Dashboard, Long> {

    @EntityGraph(attributePaths = "owner")
    @Query("SELECT d FROM Dashboard d WHERE d.id = :id")
    Optional<Dashboard> findByIdWithOwner(@Param("id") Long id);

    @EntityGraph(attributePaths = "owner")
    @Query("SELECT d FROM Dashboard d WHERE d.id IN :ids")
    List<Dashboard> findAllWithOwnerByIdIn(@Param("ids") Collection<Long> ids);

    @EntityGraph(attributePaths = "owner")
    @Query("""
            SELECT d FROM Dashboard d
            WHERE d.owner.id = :userId
               OR (d.visibility = 'PUBLIC' AND d.owner.role = 'ROLE_ADMIN')
            """)
    Page<Dashboard> findVisibleToUser(@Param("userId") Long userId, Pageable pageable);
}
