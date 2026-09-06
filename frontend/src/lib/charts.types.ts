export interface MetricDataPoint {
  timestamp: string;
  value: number;
}

export interface DeviceMetricData {
  deviceId: string;
  deviceName: string;
  metricName: string;
  unit?: string;
  dataPoints: MetricDataPoint[];
}

export interface MetricsQueryParams {
  deviceIds: string[];
  metrics: string[];
  startDateTime: Date;
  endDateTime: Date;
}

export type ChartType = "timeseries" | "comparison" | "table" | "gauge" | "heatmap";

export interface ChartProps {
  deviceIds: string[];
  metrics: string[];
  startDateTime: Date;
  endDateTime: Date;
  title: string;
  description?: string;
}

export interface TimeSeriesChartData {
  timestamp: string;
  timeMs: number;
  [key: string]: string | number | null | undefined;
}

export interface ComparisonChartData {
  timestamp: string;
  [deviceName: string]: string | number;
}

export interface TableRowData {
  deviceId: string;
  deviceName: string;
  /** Parent device used for row links (same as deviceId for device rows). */
  linkDeviceId?: string;
  /** Set for interface-scope table rows. */
  interfaceId?: string;
  interfaceName?: string;
  deviceLabel?: string;
  [metricName: string]: string | number | undefined;
}

export interface GaugeChartData {
  deviceId: string;
  deviceName: string;
  metric: string;
  value: number;
  unit?: string;
  /** Pre-formatted display string for the primary value. */
  valueText?: string;
  /** Pre-formatted display string for the capacity / max value. */
  maxText?: string;
  min: number;
  max: number;
  thresholdWarning?: number;
  thresholdCritical?: number;
}

export interface HorizontalBarItem {
  id: string;
  label: string;
  value: number;
  valueText: string;
}

export interface HorizontalBarPanel {
  id: string;
  title: string;
  items: HorizontalBarItem[];
}

/** One hourly bucket in the device availability heatmap. */
export interface AvailabilityCell {
  /** Local calendar date, formatted as yyyy-MM-dd. */
  date: string;
  /** Local hour of day, 0-23. */
  hour: number;
  status: "up" | "down" | "unknown";
}

/** Maps a server bucket timestamp to the local heatmap cell it represents. */
export function bucketTimestampToAvailabilityCell(
  timestamp: string,
  status: "up" | "down",
): AvailabilityCell {
  const windowStart = new Date(timestamp);
  const year = windowStart.getFullYear();
  const month = String(windowStart.getMonth() + 1).padStart(2, "0");
  const day = String(windowStart.getDate()).padStart(2, "0");

  return {
    date: `${year}-${month}-${day}`,
    hour: windowStart.getHours(),
    status,
  };
}
