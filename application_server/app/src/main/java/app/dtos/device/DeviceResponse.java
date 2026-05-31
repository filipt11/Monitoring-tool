package app.dtos.device;

public record DeviceResponse(
        Long id,
        String ip,
        String hostname,
        String vendor,
        String model,
        String username,
        String password,
        Integer port,
        Boolean https) {
}
