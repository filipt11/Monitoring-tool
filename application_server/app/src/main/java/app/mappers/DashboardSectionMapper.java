package app.mappers;

import app.dtos.dashboardSection.DashboardSectionCreateResponseDto;
import app.dtos.dashboardSection.DashboardSectionDetailResponseDto;
import app.dtos.dashboardSection.DashboardSectionResponseDto;
import app.entities.DashboardSection;
import app.entities.DashboardSectionSourceType;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.Collections;
import java.util.List;

@Mapper(componentModel = "spring")
public interface DashboardSectionMapper {

    @Mapping(target = "dashboardId", source = "dashboard.id")
    @Mapping(target = "sourceItemCount", expression = "java(sourceItemCount(section))")
    DashboardSectionResponseDto toResponseDto(DashboardSection section);

    @Mapping(target = "dashboardId", source = "dashboard.id")
    @Mapping(target = "deviceIds", expression = "java(mapDeviceIds(section))")
    @Mapping(target = "deviceGroupId", expression = "java(mapDeviceGroupId(section))")
    @Mapping(target = "interfaceIds", expression = "java(mapInterfaceIds(section))")
    @Mapping(target = "interfaceGroupId", expression = "java(mapInterfaceGroupId(section))")
    DashboardSectionCreateResponseDto toCreateResponseDto(DashboardSection section);

    @Mapping(target = "dashboardId", source = "dashboard.id")
    @Mapping(target = "deviceIds", expression = "java(mapDeviceIds(section))")
    @Mapping(target = "deviceGroupId", expression = "java(mapDeviceGroupId(section))")
    @Mapping(target = "interfaceIds", expression = "java(mapInterfaceIds(section))")
    @Mapping(target = "interfaceGroupId", expression = "java(mapInterfaceGroupId(section))")
    DashboardSectionDetailResponseDto toDetailResponseDto(DashboardSection section);

    default int sourceItemCount(DashboardSection section) {
        if (section.getSourceType() == null) {
            return 0;
        }

        return switch (section.getSourceType()) {
            case DEVICE_LIST -> section.getDevices() == null ? 0 : section.getDevices().size();
            case DEVICE_GROUP -> section.getDeviceGroup() == null ? 0 : 1;
            case INTERFACE_LIST -> section.getInterfaces() == null ? 0 : section.getInterfaces().size();
            case INTERFACE_GROUP -> section.getInterfaceGroup() == null ? 0 : 1;
        };
    }

    default List<Long> mapDeviceIds(DashboardSection section) {
        if (section.getSourceType() != DashboardSectionSourceType.DEVICE_LIST
                || section.getDevices() == null) {
            return Collections.emptyList();
        }
        return section.getDevices().stream()
                .map(device -> device.getId())
                .toList();
    }

    default Long mapDeviceGroupId(DashboardSection section) {
        if (section.getSourceType() != DashboardSectionSourceType.DEVICE_GROUP
                || section.getDeviceGroup() == null) {
            return null;
        }
        return section.getDeviceGroup().getId();
    }

    default List<Long> mapInterfaceIds(DashboardSection section) {
        if (section.getSourceType() != DashboardSectionSourceType.INTERFACE_LIST
                || section.getInterfaces() == null) {
            return Collections.emptyList();
        }
        return section.getInterfaces().stream()
                .map(deviceInterface -> deviceInterface.getId())
                .toList();
    }

    default Long mapInterfaceGroupId(DashboardSection section) {
        if (section.getSourceType() != DashboardSectionSourceType.INTERFACE_GROUP
                || section.getInterfaceGroup() == null) {
            return null;
        }
        return section.getInterfaceGroup().getId();
    }
}
