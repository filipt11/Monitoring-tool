package app.exceptions;

public class InterfaceGroupAccessDeniedException extends RuntimeException {
    public InterfaceGroupAccessDeniedException() {
        super("You do not have permission to modify this interface group");
    }
}
