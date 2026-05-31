package app.mappers;

import app.dtos.device.DeviceNoCredentialsResponse;
import app.entities.Device;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface DeviceMapper {
    DeviceNoCredentialsResponse toNoCredentialsDto(Device device);
}
