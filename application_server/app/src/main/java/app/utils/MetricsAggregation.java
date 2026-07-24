package app.utils;

import java.time.Duration;
import java.time.Instant;

public final class MetricsAggregation {
    private static final long MS_PER_HOUR = 60L * 60L * 1000L;
    private static final long MS_PER_DAY = 24L * MS_PER_HOUR;

    private MetricsAggregation() {
    }

    public static String resolveWindow(Instant start, Instant end) {
        long durationMs = Duration.between(start, end).toMillis();

        if (durationMs <= MS_PER_DAY) {
            return "5m";
        }
        if (durationMs <= 7L * MS_PER_DAY) {
            return "30m";
        }
        if (durationMs <= 30L * MS_PER_DAY) {
            return "1h";
        }
        return "1d";
    }

    public static String resolveAggregateFn(String window) {
        return "5m".equals(window) ? "last" : "mean";
    }

    public static String buildAggregateWindowClause(Instant start, Instant end) {
        String window = resolveWindow(start, end);
        String fn = resolveAggregateFn(window);
        return String.format(
                "aggregateWindow(every: %s, fn: %s, createEmpty: false, timeSrc: \"_start\")",
                window,
                fn
        );
    }
}
