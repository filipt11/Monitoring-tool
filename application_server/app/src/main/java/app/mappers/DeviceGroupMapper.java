package app.mappers;

import app.dtos.deviceGroup.DeviceGroupResponseDto;
import app.entities.DeviceGroup;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring", uses = DeviceMapper.class)
public interface DeviceGroupMapper {

    @Mapping(target = "ownerId", source = "deviceGroup.owner.id")
    @Mapping(target = "ownerUsername", source = "deviceGroup.owner.username")
    @Mapping(target = "deviceCount", source = "deviceCount")
    @Mapping(target = "sections", expression = "java(java.util.Collections.emptyList())")
    DeviceGroupResponseDto toResponseDto(DeviceGroup deviceGroup, int deviceCount);
}
