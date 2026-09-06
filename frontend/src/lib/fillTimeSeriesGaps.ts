import type { TimeSeriesChartData } from "@/lib/charts.types";
import { resolveMetricsBucketMs } from "@/lib/metricsAggregation";

/** Default bucket when range is unavailable; matches the shortest auto tier. */
export const METRICS_BUCKET_MS = resolveMetricsBucketMs(
  new Date(Date.now() - 60 * 60 * 1000),
  new Date(),
);

export function alignToMetricsBucket(timeMs: number, bucketMs = METRICS_BUCKET_MS): number {
  return Math.floor(timeMs / bucketMs) * bucketMs;
}

interface FillTimeSeriesGapsOptions {
  data: TimeSeriesChartData[];
  metrics: string[];
  rangeStart: Date;
  rangeEnd: Date;
  bucketMs?: number;
  formatTimestamp: (date: Date) => string;
}

function createNullRow(
  bucket: number,
  metrics: string[],
  formatTimestamp: (date: Date) => string,
): TimeSeriesChartData {
  const row: TimeSeriesChartData = {
    timeMs: bucket,
    timestamp: formatTimestamp(new Date(bucket)),
  };

  for (const metric of metrics) {
    row[metric] = null;
  }

  return row;
}

function mergeRowMetrics(
  row: TimeSeriesChartData,
  metrics: string[],
): TimeSeriesChartData {
  const merged: TimeSeriesChartData = {
    timeMs: row.timeMs,
    timestamp: row.timestamp,
  };

  for (const metric of metrics) {
    const value = row[metric];
    merged[metric] =
      typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  return merged;
}

function inferEffectiveBucketMs(data: TimeSeriesChartData[], bucketMs: number): number {
  if (data.length < 2) {
    return bucketMs;
  }

  const sorted = [...data].sort((left, right) => left.timeMs - right.timeMs);
  const gaps = sorted
    .slice(1)
    .map((row, index) => row.timeMs - sorted[index].timeMs)
    .filter((gap) => gap > 0)
    .sort((left, right) => left - right);

  if (gaps.length === 0) {
    return bucketMs;
  }

  const medianGap = gaps[Math.floor(gaps.length / 2)] ?? bucketMs;

  // When backend buckets are coarser than the configured tier, follow actual spacing
  // so gap-fill does not split hourly points into invisible single-point segments.
  if (medianGap > bucketMs * 1.5) {
    return medianGap;
  }

  return bucketMs;
}

/**
 * Inserts null buckets only between samples so lines break during outages
 * without expanding the entire selected range into thousands of points.
 */
export function fillTimeSeriesGaps({
  data,
  metrics,
  bucketMs = METRICS_BUCKET_MS,
  formatTimestamp,
}: FillTimeSeriesGapsOptions): TimeSeriesChartData[] {
  if (data.length === 0 || metrics.length === 0) {
    return [];
  }

  const effectiveBucketMs = inferEffectiveBucketMs(data, bucketMs);
  const valuesByBucket = new Map<number, TimeSeriesChartData>();

  for (const row of data) {
    const bucket = alignToMetricsBucket(row.timeMs, effectiveBucketMs);
    const existing = valuesByBucket.get(bucket);

    valuesByBucket.set(
      bucket,
      existing
        ? {
            ...existing,
            ...row,
            timeMs: bucket,
            timestamp: formatTimestamp(new Date(bucket)),
          }
        : {
            ...row,
            timeMs: bucket,
            timestamp: formatTimestamp(new Date(bucket)),
          },
    );
  }

  const buckets = [...valuesByBucket.keys()].sort((left, right) => left - right);
  if (buckets.length === 0) {
    return [];
  }

  const result: TimeSeriesChartData[] = [];

  for (let index = 0; index < buckets.length; index++) {
    const bucket = buckets[index];
    result.push(mergeRowMetrics(valuesByBucket.get(bucket)!, metrics));

    const nextBucket = buckets[index + 1];
    if (nextBucket == null) {
      continue;
    }

    // One null marker per outage — enough to break the line without fragmenting
    // coarser backend buckets into invisible single-point segments.
    if (nextBucket - bucket > effectiveBucketMs * 1.5) {
      result.push(createNullRow(bucket + effectiveBucketMs, metrics, formatTimestamp));
    }
  }

  return result;
}
