const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export type MetricsAggregationWindow = "5m" | "30m" | "1h" | "1d";

/** Keep in sync with `MetricsAggregation.java` on the backend. */
export function resolveMetricsAggregationWindow(start: Date, end: Date): MetricsAggregationWindow {
  const durationMs = end.getTime() - start.getTime();

  if (durationMs <= MS_PER_DAY) {
    return "5m";
  }
  if (durationMs <= 7 * MS_PER_DAY) {
    return "30m";
  }
  if (durationMs <= 30 * MS_PER_DAY) {
    return "1h";
  }
  return "1d";
}

export function resolveMetricsBucketMs(start: Date, end: Date): number {
  switch (resolveMetricsAggregationWindow(start, end)) {
    case "5m":
      return 5 * 60 * 1000;
    case "30m":
      return 30 * 60 * 1000;
    case "1h":
      return MS_PER_HOUR;
    case "1d":
      return MS_PER_DAY;
  }
}

const AGGREGATION_LABELS: Record<MetricsAggregationWindow, string> = {
  "5m": "5 minutes",
  "30m": "30 minutes",
  "1h": "1 hour",
  "1d": "1 day",
};

export function formatMetricsAggregationLabel(start: Date, end: Date): string {
  const window = resolveMetricsAggregationWindow(start, end);
  return AGGREGATION_LABELS[window];
}
