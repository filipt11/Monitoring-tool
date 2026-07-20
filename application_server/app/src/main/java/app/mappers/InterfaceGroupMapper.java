package app.mappers;

import app.dtos.interfaceGroup.InterfaceGroupResponseDto;
import app.entities.InterfaceGroup;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface InterfaceGroupMapper {

    @Mapping(target = "ownerId", source = "interfaceGroup.owner.id")
    @Mapping(target = "ownerUsername", source = "interfaceGroup.owner.username")
    @Mapping(target = "interfaceCount", source = "interfaceCount")
    InterfaceGroupResponseDto toResponseDto(InterfaceGroup interfaceGroup, int interfaceCount);
}
