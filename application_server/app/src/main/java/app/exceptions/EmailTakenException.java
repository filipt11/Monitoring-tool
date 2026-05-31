package app.exceptions;

public class EmailTakenException extends RuntimeException {
    public EmailTakenException() {
        super("Email is already taken");
    }
}
