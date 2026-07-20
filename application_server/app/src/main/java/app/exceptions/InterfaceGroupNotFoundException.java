package app.exceptions;

public class InterfaceGroupNotFoundException extends RuntimeException {
    public InterfaceGroupNotFoundException() {
        super("Interface group not found");
    }
}
