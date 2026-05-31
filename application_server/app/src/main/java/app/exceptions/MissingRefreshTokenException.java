package app.exceptions;

public class MissingRefreshTokenException extends RuntimeException {
    public MissingRefreshTokenException() {
        super("There is no refresh token in database");
    }
}
