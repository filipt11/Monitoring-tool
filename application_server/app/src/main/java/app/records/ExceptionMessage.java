package app.records;

import java.time.Instant;

public record ExceptionMessage(
        String message,
        String path,
        Instant timestamp

) {
    public ExceptionMessage(String message, String path) {
        this(message, path, Instant.now());
    }
}

