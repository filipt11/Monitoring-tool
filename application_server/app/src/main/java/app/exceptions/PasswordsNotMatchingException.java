package app.exceptions;

public class PasswordsNotMatchingException extends RuntimeException {
    public PasswordsNotMatchingException() {
        super("Passwords do not match");
    }
}
