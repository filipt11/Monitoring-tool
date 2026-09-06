import { apiFetch } from "@/api/client";

/** A single sample returned by the metrics endpoint for one device. */
export interface MetricPointApi {
  timestamp: string;
  values: Record<string, number>;
}

/** Response shape of `GET /api/data/metrics/devices`. */
export interface DeviceMetricsApiResponse {
  deviceId: string;
  dataPoints: MetricPointApi[];
}

export interface FetchDeviceMetricsParams {
  deviceIds: string[];
  metrics: string[];
  start: Date;
  end: Date;
}

/** Numeric values used for the `status` metric written by the poller. */
export const DEVICE_STATUS_UP = 1;
export const DEVICE_STATUS_DOWN = 0;

export interface DeviceLatestMetrics {
  status?: number;
  cpuUsage?: number;
  memoryUsagePct?: number;
}

export function statusLabel(status?: number): string {
  if (status == null) return "Unknown";
  return status === DEVICE_STATUS_UP ? "Up" : "Down";
}

/** Latest point that contains a given metric field, sorted by timestamp. */
export function findLatestPointWithField(
  points: MetricPointApi[],
  field: string,
): MetricPointApi | undefined {
  return [...points]
    .sort(
      (left, right) =>
        new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
    )
    .reverse()
    .find((point) => point.values?.[field] != null);
}

export function extractLatestMetrics(
  response: DeviceMetricsApiResponse[],
): Map<string, DeviceLatestMetrics> {
  const nextMetrics = new Map<string, DeviceLatestMetrics>();

  response.forEach((entry) => {
    const statusPoint = findLatestPointWithField(entry.dataPoints, "status");
    const cpuPoint = findLatestPointWithField(entry.dataPoints, "cpu_usage");
    const memoryPoint = findLatestPointWithField(entry.dataPoints, "memory_usage_pct");

    if (!statusPoint && !cpuPoint && !memoryPoint) {
      return;
    }

    nextMetrics.set(entry.deviceId, {
      status: statusPoint?.values?.status,
      cpuUsage: cpuPoint?.values?.cpu_usage,
      memoryUsagePct: memoryPoint?.values?.memory_usage_pct,
    });
  });

  return nextMetrics;
}

/**
 * Fetches device metrics from the monitoring backend.
 *
 * Maps to `GET /api/data/metrics/devices?deviceIds=&metrics=&start=&end=`.
 */
export async function fetchDeviceMetrics({
  deviceIds,
  metrics,
  start,
  end,
}: FetchDeviceMetricsParams): Promise<DeviceMetricsApiResponse[]> {
  const query = new URLSearchParams({
    deviceIds: deviceIds.join(","),
    metrics: metrics.join(","),
    start: start.toISOString(),
    end: end.toISOString(),
  });

  return apiFetch<DeviceMetricsApiResponse[]>(
    `/api/data/metrics/devices?${query.toString()}`,
  );
}

/** Response shape of `GET /api/data/metrics/devices/summary`. */
export interface DeviceMetricsSummaryApiResponse {
  deviceId: string;
  values: Record<string, number>;
}

export interface FetchDeviceMetricsSummaryParams {
  deviceIds: string[];
  metrics: string[];
  start: Date;
  end: Date;
}

/**
 * Fetches mean metric values per device for the selected time range.
 *
 * Maps to `GET /api/data/metrics/devices/summary?deviceIds=&metrics=&start=&end=`.
 */
export async function fetchDeviceMetricsSummary({
  deviceIds,
  metrics,
  start,
  end,
}: FetchDeviceMetricsSummaryParams): Promise<DeviceMetricsSummaryApiResponse[]> {
  const query = new URLSearchParams({
    deviceIds: deviceIds.join(","),
    metrics: metrics.join(","),
    start: start.toISOString(),
    end: end.toISOString(),
  });

  return apiFetch<DeviceMetricsSummaryApiResponse[]>(
    `/api/data/metrics/devices/summary?${query.toString()}`,
  );
}

export interface DeviceAvailabilityApiResponse {
  deviceId: string;
  buckets: Array<{
    timestamp: string;
    status: "up" | "down";
  }>;
}

export interface FetchDeviceAvailabilityParams {
  deviceIds: string[];
  start: Date;
  end: Date;
}

/**
 * Fetches hourly availability buckets for device heatmaps.
 *
 * Maps to `GET /api/data/metrics/devices/availability?deviceIds=&start=&end=`.
 * Each bucket is aggregated server-side with a 1-hour mean of the status metric.
 */
export async function fetchDeviceAvailability({
  deviceIds,
  start,
  end,
}: FetchDeviceAvailabilityParams): Promise<DeviceAvailabilityApiResponse[]> {
  const query = new URLSearchParams({
    deviceIds: deviceIds.join(","),
    start: start.toISOString(),
    end: end.toISOString(),
  });

  return apiFetch<DeviceAvailabilityApiResponse[]>(
    `/api/data/metrics/devices/availability?${query.toString()}`,
  );
}

/** Minimal device info used to enrich the details page header. */
export interface DeviceInfo {
  id: number;
  hostname: string;
  ip: string;
  vendor?: string;
  model?: string;
  createdAt?: string;
}

export async function fetchDeviceInfo(deviceId: string): Promise<DeviceInfo> {
  const data = await apiFetch<Record<string, unknown>>(`/api/devices/${deviceId}`);

  return {
    id: Number(data.id ?? deviceId),
    hostname: String(data.hostname ?? `Device ${deviceId}`),
    ip: String(data.ip ?? data.ipAddress ?? "Unknown"),
    vendor: typeof data.vendor === "string" ? data.vendor : undefined,
    model: typeof data.model === "string" ? data.model : undefined,
    createdAt:
      typeof data.createdAt === "string"
        ? data.createdAt
        : typeof data.created_at === "string"
          ? data.created_at
          : undefined,
  };
}

/** Discovered interface catalog entry from `GET /api/devices/{id}/interfaces`. */
export interface DeviceInterfaceInfo {
  id: number;
  deviceId: number;
  name: string;
  ifIndex: number;
  mac?: string | null;
  speedBps?: number | null;
  adminStatus?: string | null;
  operStatus?: string | null;
  discoveredAt?: string;
}

export async function fetchDeviceInterfaces(
  deviceId: string,
): Promise<DeviceInterfaceInfo[]> {
  return apiFetch<DeviceInterfaceInfo[]>(`/api/devices/${deviceId}/interfaces`);
}

/** Response shape of `GET /api/data/metrics/interfaces`. */
export interface InterfaceMetricsApiResponse {
  deviceId: string;
  ifIndex: string;
  dataPoints: MetricPointApi[];
}

export interface FetchInterfaceMetricsParams {
  /** Each entry is `deviceId:ifIndex`, e.g. `2:4`. */
  interfaces: string[];
  metrics: string[];
  start: Date;
  end: Date;
}

/**
 * Fetches interface metrics from the monitoring backend.
 *
 * Maps to `GET /api/data/metrics/interfaces?interfaces=&metrics=&start=&end=`.
 */
export async function fetchInterfaceMetrics({
  interfaces,
  metrics,
  start,
  end,
}: FetchInterfaceMetricsParams): Promise<InterfaceMetricsApiResponse[]> {
  const query = new URLSearchParams({
    interfaces: interfaces.join(","),
    metrics: metrics.join(","),
    start: start.toISOString(),
    end: end.toISOString(),
  });

  return apiFetch<InterfaceMetricsApiResponse[]>(
    `/api/data/metrics/interfaces?${query.toString()}`,
  );
}

/** Response shape of `GET /api/data/metrics/interfaces/summary`. */
export interface InterfaceMetricsSummaryApiResponse {
  deviceId: string;
  ifIndex: string;
  values: Record<string, number>;
}

export interface FetchInterfaceMetricsSummaryParams {
  interfaces: string[];
  metrics: string[];
  start: Date;
  end: Date;
}

/**
 * Fetches mean metric values per interface for the selected time range.
 *
 * Maps to `GET /api/data/metrics/interfaces/summary?interfaces=&metrics=&start=&end=`.
 */
export async function fetchInterfaceMetricsSummary({
  interfaces,
  metrics,
  start,
  end,
}: FetchInterfaceMetricsSummaryParams): Promise<InterfaceMetricsSummaryApiResponse[]> {
  const query = new URLSearchParams({
    interfaces: interfaces.join(","),
    metrics: metrics.join(","),
    start: start.toISOString(),
    end: end.toISOString(),
  });

  return apiFetch<InterfaceMetricsSummaryApiResponse[]>(
    `/api/data/metrics/interfaces/summary?${query.toString()}`,
  );
}

export function toInterfaceMetricKey(deviceId: string | number, ifIndex: string | number) {
  return `${deviceId}:${ifIndex}`;
}
