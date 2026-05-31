package app.dtos.myUser;

public record MyUserDto(
        Long id,
        String username,
        String password,
        String password2,
        String email,
        String role,
        boolean isBanned) {
}
