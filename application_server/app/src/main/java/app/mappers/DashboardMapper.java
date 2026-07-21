package app.mappers;

import app.dtos.dashboard.DashboardCreateResponseDto;
import app.entities.Dashboard;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface DashboardMapper {

    @Mapping(target = "ownerId", source = "owner.id")
    @Mapping(target = "ownerUsername", source = "owner.username")
    DashboardCreateResponseDto toCreateResponseDto(Dashboard dashboard);
}
