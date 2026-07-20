package app.repositories;

import app.entities.InterfaceGroup;
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

public interface InterfaceGroupRepository extends JpaRepository<InterfaceGroup, Long> {

    @EntityGraph(attributePaths = "owner")
    @Query("SELECT ig FROM InterfaceGroup ig WHERE ig.id = :id")
    Optional<InterfaceGroup> findByIdWithOwner(@Param("id") Long id);

    @EntityGraph(attributePaths = "owner")
    @Query("SELECT ig FROM InterfaceGroup ig WHERE ig.id IN :ids")
    List<InterfaceGroup> findAllWithOwnerByIdIn(@Param("ids") Collection<Long> ids);

    @Query(value = """
            SELECT igi.interface_group_id, COUNT(i.id)
            FROM interface_group_interfaces igi
            INNER JOIN interfaces i ON i.id = igi.interface_id
            WHERE igi.interface_group_id IN (:ids)
            GROUP BY igi.interface_group_id
            """, nativeQuery = true)
    List<Object[]> countInterfacesByGroupIds(@Param("ids") Collection<Long> ids);

    @Modifying(clearAutomatically = true)
    @Query(value = """
            DELETE FROM interface_group_interfaces igi
            WHERE NOT EXISTS (
                SELECT 1 FROM interfaces i WHERE i.id = igi.interface_id
            )
            """, nativeQuery = true)
    void removeOrphanedInterfaceGroupMemberships();

    @Modifying(clearAutomatically = true)
    @Query(value = "DELETE FROM interface_group_interfaces WHERE interface_id = :interfaceId", nativeQuery = true)
    void removeInterfaceFromAllGroups(@Param("interfaceId") Long interfaceId);

    @EntityGraph(attributePaths = {"owner", "interfaces"})
    @Query("SELECT ig FROM InterfaceGroup ig WHERE ig.id = :id")
    Optional<InterfaceGroup> findByIdWithOwnerAndInterfaces(@Param("id") Long id);

    @Query("""
            SELECT ig FROM InterfaceGroup ig
            WHERE ig.visibility = 'PUBLIC'
               OR (ig.visibility = 'PRIVATE' AND ig.owner.id = :userId)
            """)
    Page<InterfaceGroup> findVisibleToUser(@Param("userId") Long userId, Pageable pageable);
}
