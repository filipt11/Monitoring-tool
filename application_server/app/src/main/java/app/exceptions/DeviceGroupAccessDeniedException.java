package app.exceptions;

public class DeviceGroupAccessDeniedException extends RuntimeException {
    public DeviceGroupAccessDeniedException() {
        super("You do not have permission to modify this device group");
    }
}
