package app.exceptions;

public class DeviceGroupNotFoundException extends RuntimeException {
    public DeviceGroupNotFoundException() {
        super("Device group not found");
    }
}
