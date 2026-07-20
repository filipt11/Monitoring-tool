package app.exceptions;

public class InterfaceNotFoundException extends RuntimeException {
    public InterfaceNotFoundException() {
        super("Interface not found");
    }
}
