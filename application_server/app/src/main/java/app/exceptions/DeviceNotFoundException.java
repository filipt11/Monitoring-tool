package app.exceptions;

public class DeviceNotFoundException extends RuntimeException {
    public DeviceNotFoundException() {
        super("Device not found");
    }
}
