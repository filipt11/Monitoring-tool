import { apiFetch } from "@/api/client";

export type AnomalyDetector = "ewma" | "cusum";
export type AnomalyScope = "device" | "interface";

export type AnomalyMetric =
  | "cpu_usage"
  | "memory_usage_pct"
  | "in_util_pct"
  | "out_util_pct";

export interface AnomalyItem {
  detector: AnomalyDetector;
  scope: AnomalyScope;
  metric: AnomalyMetric;
  hostname: string;
  ifName: string | null;
  startTime: string;
  endTime: string;
  value: number;
  peakValue: number;
  sampleCount: number;
  cusumSh?: number | null;
  cusumSl?: number | null;
}

export interface AnomaliesResponse {
  start: string;
  end: string;
  computeStart?: string;
  computeEnd?: string;
  defaultLookbackHours: number;
  contextLookbackHours?: number;
  items: AnomalyItem[];
}

export interface FetchAnomaliesParams {
  start: Date;
  end: Date;
  metrics?: AnomalyMetric[];
  detectors?: AnomalyDetector[];
  hostname?: string;
  mergeCusumEpisodes?: boolean;
}

export const ANOMALY_METRICS: AnomalyMetric[] = [
  "cpu_usage",
  "memory_usage_pct",
  "in_util_pct",
  "out_util_pct",
];

export const ANOMALY_DETECTORS: AnomalyDetector[] = ["ewma", "cusum"];

export const ANOMALY_DEFAULT_LOOKBACK_MS = 3 * 60 * 60 * 1000;

export function createDefaultAnomaliesRange(now = new Date()): { start: Date; end: Date } {
  return {
    start: new Date(now.getTime() - ANOMALY_DEFAULT_LOOKBACK_MS),
    end: now,
  };
}

/**
 * Maps to `GET /api/data/anomalies` on the application server (proxied to the detector service).
 */
export async function fetchAnomalies({
  start,
  end,
  metrics,
  detectors,
  hostname,
  mergeCusumEpisodes = true,
}: FetchAnomaliesParams): Promise<AnomaliesResponse> {
  const query = new URLSearchParams({
    start: start.toISOString(),
    end: end.toISOString(),
    mergeCusumEpisodes: String(mergeCusumEpisodes),
  });

  metrics?.forEach((metric) => query.append("metrics", metric));
  detectors?.forEach((detector) => query.append("detectors", detector));

  const trimmedHostname = hostname?.trim();
  if (trimmedHostname) {
    query.set("hostname", trimmedHostname);
  }

  return apiFetch<AnomaliesResponse>(`/api/data/anomalies?${query.toString()}`);
}

export function anomalyMetricLabel(metric: AnomalyMetric): string {
  switch (metric) {
    case "cpu_usage":
      return "CPU";
    case "memory_usage_pct":
      return "Memory";
    case "in_util_pct":
      return "IN utilization";
    case "out_util_pct":
      return "OUT utilization";
    default:
      return metric;
  }
}

export function anomalyDetectorLabel(detector: AnomalyDetector): string {
  return detector === "ewma" ? "Point" : "Sustained";
}

export function formatAnomalyValue(metric: AnomalyMetric, value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  if (metric === "cpu_usage" || metric === "memory_usage_pct" || metric.includes("util")) {
    return `${value.toFixed(metric === "cpu_usage" ? 0 : 2)}%`;
  }

  return String(value);
}
