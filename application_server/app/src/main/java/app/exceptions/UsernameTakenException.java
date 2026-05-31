package app.exceptions;

public class UsernameTakenException extends RuntimeException {
    public UsernameTakenException() {
        super("Username is already taken");
    }
}
