package app.mappers;

import app.dtos.device.DeviceInterfaceResponse;
import app.entities.DeviceInterface;
import org.mapstruct.Mapper;

import java.util.List;

@Mapper(componentModel = "spring")
public interface DeviceInterfaceMapper {
    DeviceInterfaceResponse toResponseDto(DeviceInterface deviceInterface);

    List<DeviceInterfaceResponse> toResponseDtoList(List<DeviceInterface> deviceInterfaces);
}
