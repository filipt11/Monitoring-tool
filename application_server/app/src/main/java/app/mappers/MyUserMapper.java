package app.mappers;

import app.dtos.myUser.MyUserDto;
import app.dtos.myUser.MyUserRegisterDto;
import app.dtos.myUser.MyUserResponseDto;
import app.entities.MyUser;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface MyUserMapper {
    MyUserResponseDto toDto(MyUser myUser);

    MyUserDto fromRegisterToDto(MyUserRegisterDto myUserRegisterDto);

    @Mapping(target = "password", ignore = true)
    @Mapping(target = "role", ignore = true)
    @Mapping(target = "id", ignore = true)
    MyUser toEntity(MyUserRegisterDto registerDto);

    MyUserResponseDto toResponseDto(MyUser myUser);
}
