package app.dtos.device;

public record DeviceNoCredentialsResponse(
        Long id,
        String ip,
        String hostname,
        String vendor,
        String model,
        Integer port,
        Boolean https
) {
}
