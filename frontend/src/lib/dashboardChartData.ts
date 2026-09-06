import type {
  DeviceMetricsApiResponse,
  DeviceMetricsSummaryApiResponse,
  InterfaceMetricsApiResponse,
  InterfaceMetricsSummaryApiResponse,
  MetricPointApi,
} from "@/lib/metricsApi";
import type {
  GaugeChartData,
  HorizontalBarPanel,
  TableRowData,
  TimeSeriesChartData,
} from "@/lib/charts.types";
import {
  getMetricDefinition,
  getMetricLabels,
  type DashboardTimeseriesLayout,
} from "@/lib/dashboardConfig";
import {
  getDisplayMetricLabel,
  getMetricMaxValues,
  scaleMetricForDisplay,
  scaleMetricForPanelDisplay,
} from "@/lib/dashboardMetricFormat";
import { formatBytesValue, getBytesDisplayScale } from "@/lib/formatBytes";
import type { ResolvedInterfaceSource } from "@/lib/resolveSectionSources";

/** Align multi-item samples to the same minute bucket so lines stay continuous. */
const COMPARISON_BUCKET_MS = 60_000;

export interface DashboardChartPanel {
  id: string;
  title: string;
  data: TimeSeriesChartData[];
  seriesKeys: string[];
  metricLabels: Record<string, string>;
  valueDecimals?: number;
}

/** Gradient fill only when a chart is configured with a single non-availability series. */
export function shouldPanelUseAreaFill(panel: DashboardChartPanel): boolean {
  if (panel.seriesKeys.length !== 1) {
    return false;
  }

  return getMetricDefinition(panel.seriesKeys[0])?.isAvailability !== true;
}

function formatChartTimestamp(date: Date): string {
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function bucketTimeMs(date: Date): number {
  return Math.floor(date.getTime() / COMPARISON_BUCKET_MS) * COMPARISON_BUCKET_MS;
}

function finalizeTimeSeriesRows(
  pointsByTime: Map<number, TimeSeriesChartData>,
  seriesKeys: string[],
): TimeSeriesChartData[] {
  return [...pointsByTime.values()]
    .sort((left, right) => left.timeMs - right.timeMs)
    .map((row) => {
      const complete: TimeSeriesChartData = { ...row };

      for (const key of seriesKeys) {
        if (!(key in complete)) {
          complete[key] = null;
        }
      }

      return complete;
    });
}

function buildSingleEntityChart(
  id: string,
  title: string,
  dataPoints: MetricPointApi[],
  metrics: string[],
): DashboardChartPanel {
  const pointsByTime = new Map<number, TimeSeriesChartData>();

  for (const point of dataPoints) {
    const timestamp = new Date(point.timestamp);
    const timeMs = timestamp.getTime();

    const row = pointsByTime.get(timeMs) ?? {
      timeMs,
      timestamp: formatChartTimestamp(timestamp),
    };

    for (const metric of metrics) {
      const value = point.values?.[metric];
      if (value == null) continue;
      row[metric] = value;
    }

    pointsByTime.set(timeMs, row);
  }

  return {
    id,
    title,
    data: finalizeTimeSeriesRows(pointsByTime, metrics),
    seriesKeys: [...metrics],
    metricLabels: getMetricLabels(metrics),
  };
}

function buildSingleMetricComparisonChart(
  metric: string,
  entities: Array<{ id: string; label: string; dataPoints: MetricPointApi[] }>,
): DashboardChartPanel {
  const seriesKeys = entities.map((entity) => entity.label);
  const pointsByTime = new Map<number, TimeSeriesChartData>();

  for (const entity of entities) {
    for (const point of entity.dataPoints) {
      const value = point.values?.[metric];
      if (value == null) continue;

      const timeMs = bucketTimeMs(new Date(point.timestamp));
      const row = pointsByTime.get(timeMs) ?? {
        timeMs,
        timestamp: formatChartTimestamp(new Date(timeMs)),
      };
      row[entity.label] = value;
      pointsByTime.set(timeMs, row);
    }
  }

  return {
    id: metric,
    title: getMetricDefinition(metric)?.label ?? metric,
    data: finalizeTimeSeriesRows(pointsByTime, seriesKeys),
    seriesKeys,
    metricLabels: Object.fromEntries(seriesKeys.map((label) => [label, label])),
  };
}

export function buildDeviceChartPanels(
  response: DeviceMetricsApiResponse[],
  metrics: string[],
  deviceLabels: Record<string, string>,
  layout: DashboardTimeseriesLayout,
): DashboardChartPanel[] {
  if (response.length === 0 || metrics.length === 0) {
    return [];
  }

  if (layout === "per_item") {
    return response.map((entry) => {
      const label = deviceLabels[String(entry.deviceId)] ?? `Device ${entry.deviceId}`;
      return buildSingleEntityChart(entry.deviceId, label, entry.dataPoints, metrics);
    });
  }

  const entities = response.map((entry) => ({
    id: entry.deviceId,
    label: deviceLabels[String(entry.deviceId)] ?? `Device ${entry.deviceId}`,
    dataPoints: entry.dataPoints,
  }));

  return metrics.map((metric) => buildSingleMetricComparisonChart(metric, entities));
}

export function buildInterfaceChartPanels(
  response: InterfaceMetricsApiResponse[],
  metrics: string[],
  interfaces: ResolvedInterfaceSource[],
  layout: DashboardTimeseriesLayout,
): DashboardChartPanel[] {
  if (response.length === 0 || metrics.length === 0) {
    return [];
  }

  const labelByKey = Object.fromEntries(
    interfaces.map((entry) => [entry.metricKey, entry.label]),
  );

  if (layout === "per_item") {
    return response.map((entry) => {
      const metricKey = `${entry.deviceId}:${entry.ifIndex}`;
      const label = labelByKey[metricKey] ?? metricKey;
      return buildSingleEntityChart(metricKey, label, entry.dataPoints, metrics);
    });
  }

  const entities = response.map((entry) => {
    const metricKey = `${entry.deviceId}:${entry.ifIndex}`;
    return {
      id: metricKey,
      label: labelByKey[metricKey] ?? metricKey,
      dataPoints: entry.dataPoints,
    };
  });

  return metrics.map((metric) => buildSingleMetricComparisonChart(metric, entities));
}

function findLatestValue(points: MetricPointApi[], metric: string): number | undefined {
  return [...points]
    .sort(
      (left, right) =>
        new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
    )
    .reverse()
    .find((point) => point.values?.[metric] != null)?.values?.[metric];
}

/** Extra metrics fetched alongside gauge metrics to resolve capacity / max values. */
const GAUGE_COMPANION_METRICS: Record<string, string[]> = {
  memory_usage: ["memory_total", "memory_usage_pct"],
};

export function getGaugeFetchMetrics(metrics: string[]): string[] {
  const companionMetrics = metrics.flatMap((metric) => GAUGE_COMPANION_METRICS[metric] ?? []);
  return [...new Set([...metrics, ...companionMetrics])];
}

function resolveGaugeMax(
  metric: string,
  rawValue: number,
  values: Record<string, number>,
): number {
  const definition = getMetricDefinition(metric);

  if (definition?.isPercentage || definition?.isAvailability) {
    return 100;
  }

  if (metric === "memory_usage") {
    const total = values.memory_total;
    if (typeof total === "number" && total > 0) {
      return total;
    }

    const pct = values.memory_usage_pct;
    if (typeof pct === "number" && pct > 0) {
      return rawValue / (pct / 100);
    }
  }

  return Math.max(rawValue * 1.2, 100);
}

function buildGaugeEntry(
  deviceId: string,
  deviceName: string,
  metric: string,
  rawValue: number,
  allValues: Record<string, number>,
): GaugeChartData | null {
  const definition = getMetricDefinition(metric);
  const rawMax = resolveGaugeMax(metric, rawValue, allValues);

  if (definition?.scaleType === "bytes") {
    const { divisor, unit } = getBytesDisplayScale(rawValue);
    const decimals = unit === "B" ? 0 : 2;
    const gaugeValue = rawValue / divisor;
    const gaugeMax = rawMax / divisor;
    const roundedValue =
      decimals === 0 ? Math.round(gaugeValue) : Math.round(gaugeValue * 100) / 100;
    const roundedMax =
      decimals === 0 ? Math.round(gaugeMax) : Math.round(gaugeMax * 100) / 100;
    const valueFormatted = formatBytesValue(rawValue);
    const maxFormatted = formatBytesValue(rawMax);

    return {
      deviceId,
      deviceName,
      metric: getDisplayMetricLabel(metric, rawValue),
      value: roundedValue,
      max: roundedMax,
      unit: valueFormatted.unit,
      valueText: valueFormatted.text.replace(" ", ""),
      maxText: maxFormatted.text.replace(" ", ""),
      min: 0,
      thresholdWarning: definition?.isPercentage ? 75 : undefined,
      thresholdCritical: definition?.isPercentage ? 90 : undefined,
    };
  }

  const scaled = scaleMetricForDisplay(metric, rawValue);
  const scaledMax = definition?.isPercentage
    ? 100
    : definition?.isAvailability
      ? 100
      : definition?.scaleType
        ? scaleMetricForDisplay(metric, rawMax).value
        : rawMax;
  const maxScaled = scaleMetricForDisplay(metric, scaledMax);

  return {
    deviceId,
    deviceName,
    metric: definition?.scaleType
      ? getDisplayMetricLabel(metric, rawValue)
      : (definition?.label ?? metric),
    value: scaled.value,
    max: scaledMax,
    unit: scaled.unit ?? definition?.unit,
    valueText: scaled.text,
    maxText: maxScaled.text,
    min: 0,
    thresholdWarning: definition?.isPercentage ? 75 : undefined,
    thresholdCritical: definition?.isPercentage ? 90 : undefined,
  };
}

export function buildDeviceGaugeDataFromSummary(
  response: DeviceMetricsSummaryApiResponse[],
  metrics: string[],
  deviceLabels: Record<string, string>,
): GaugeChartData[] {
  const gauges: GaugeChartData[] = [];

  for (const entry of response) {
    const label = deviceLabels[String(entry.deviceId)] ?? `Device ${entry.deviceId}`;

    for (const metric of metrics) {
      const rawValue = entry.values[metric];
      if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
        continue;
      }

      const gauge = buildGaugeEntry(entry.deviceId, label, metric, rawValue, entry.values);
      if (gauge) {
        gauges.push(gauge);
      }
    }
  }

  return gauges;
}

export function buildInterfaceGaugeDataFromSummary(
  response: InterfaceMetricsSummaryApiResponse[],
  metrics: string[],
  interfaces: ResolvedInterfaceSource[],
): GaugeChartData[] {
  const labelByKey = Object.fromEntries(
    interfaces.map((entry) => [entry.metricKey, entry.label]),
  );
  const gauges: GaugeChartData[] = [];

  for (const entry of response) {
    const metricKey = `${entry.deviceId}:${entry.ifIndex}`;
    const label = labelByKey[metricKey] ?? metricKey;

    for (const metric of metrics) {
      const rawValue = entry.values[metric];
      if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
        continue;
      }

      const gauge = buildGaugeEntry(metricKey, label, metric, rawValue, entry.values);
      if (gauge) {
        gauges.push(gauge);
      }
    }
  }

  return gauges;
}

export function buildDeviceGaugeData(
  response: DeviceMetricsApiResponse[],
  metrics: string[],
  deviceLabels: Record<string, string>,
): GaugeChartData[] {
  const gauges: GaugeChartData[] = [];

  for (const entry of response) {
    const label = deviceLabels[String(entry.deviceId)] ?? `Device ${entry.deviceId}`;

    for (const metric of metrics) {
      const value = findLatestValue(entry.dataPoints, metric);
      if (value == null) continue;

      const definition = getMetricDefinition(metric);
      const scaled = scaleMetricForDisplay(metric, value);
      const rawMax = definition?.isPercentage
        ? 100
        : definition?.isAvailability
          ? 100
          : Math.max(value * 1.2, 100);
      const scaledMax = definition?.isPercentage
        ? 100
        : definition?.isAvailability
          ? 100
          : definition?.scaleType
            ? scaleMetricForDisplay(metric, rawMax).value
            : rawMax;
      const gaugeValue = scaled.value;

      gauges.push({
        deviceId: entry.deviceId,
        deviceName: label,
        metric: definition?.scaleType
          ? getDisplayMetricLabel(metric, value)
          : (definition?.label ?? metric),
        value: gaugeValue,
        unit: scaled.unit ?? definition?.unit,
        min: 0,
        max: scaledMax,
        thresholdWarning: definition?.isPercentage ? 75 : undefined,
        thresholdCritical: definition?.isPercentage ? 90 : undefined,
      });
    }
  }

  return gauges;
}

export function buildInterfaceGaugeData(
  response: InterfaceMetricsApiResponse[],
  metrics: string[],
  interfaces: ResolvedInterfaceSource[],
): GaugeChartData[] {
  const labelByKey = Object.fromEntries(
    interfaces.map((entry) => [entry.metricKey, entry.label]),
  );
  const gauges: GaugeChartData[] = [];

  for (const entry of response) {
    const metricKey = `${entry.deviceId}:${entry.ifIndex}`;
    const label = labelByKey[metricKey] ?? metricKey;

    for (const metric of metrics) {
      const value = findLatestValue(entry.dataPoints, metric);
      if (value == null) continue;

      const definition = getMetricDefinition(metric);
      const scaled = scaleMetricForDisplay(metric, value);
      const rawMax = definition?.isPercentage ? 100 : Math.max(value * 1.2, 100);
      const scaledMax = definition?.isPercentage
        ? 100
        : definition?.scaleType
          ? scaleMetricForDisplay(metric, rawMax).value
          : rawMax;

      gauges.push({
        deviceId: metricKey,
        deviceName: label,
        metric: definition?.scaleType
          ? getDisplayMetricLabel(metric, value)
          : (definition?.label ?? metric),
        value: scaled.value,
        unit: scaled.unit ?? definition?.unit,
        min: 0,
        max: scaledMax,
        thresholdWarning: definition?.isPercentage ? 75 : undefined,
        thresholdCritical: definition?.isPercentage ? 90 : undefined,
      });
    }
  }

  return gauges;
}

export function buildDeviceTableData(
  response: DeviceMetricsApiResponse[],
  metrics: string[],
  deviceLabels: Record<string, string>,
): TableRowData[] {
  return response.map((entry) => {
    const row: TableRowData = {
      deviceId: entry.deviceId,
      deviceName: deviceLabels[String(entry.deviceId)] ?? `Device ${entry.deviceId}`,
      linkDeviceId: entry.deviceId,
    };

    for (const metric of metrics) {
      const value = findLatestValue(entry.dataPoints, metric);
      if (value != null) {
        row[metric] = value;
      }
    }

    return row;
  });
}

export function buildDeviceTableDataFromSummary(
  response: DeviceMetricsSummaryApiResponse[],
  metrics: string[],
  deviceLabels: Record<string, string>,
): TableRowData[] {
  return response.map((entry) => {
    const row: TableRowData = {
      deviceId: entry.deviceId,
      deviceName: deviceLabels[String(entry.deviceId)] ?? `Device ${entry.deviceId}`,
      linkDeviceId: entry.deviceId,
    };

    for (const metric of metrics) {
      const value = entry.values[metric];
      if (typeof value === "number" && Number.isFinite(value)) {
        row[metric] = value;
      }
    }

    return row;
  });
}

function interfaceSourceByMetricKey(
  interfaces: ResolvedInterfaceSource[],
): Map<string, ResolvedInterfaceSource> {
  return new Map(interfaces.map((entry) => [entry.metricKey, entry]));
}

function applyInterfaceRowLinks(
  row: TableRowData,
  metricKey: string,
  deviceId: string,
  sourceByKey: Map<string, ResolvedInterfaceSource>,
): TableRowData {
  const source = sourceByKey.get(metricKey);

  return {
    ...row,
    linkDeviceId: deviceId,
    interfaceId: source ? String(source.interfaceId) : undefined,
    interfaceName: source?.interfaceName,
    deviceLabel: source?.deviceHostname,
  };
}

export function buildInterfaceTableData(
  response: InterfaceMetricsApiResponse[],
  metrics: string[],
  interfaces: ResolvedInterfaceSource[],
): TableRowData[] {
  const labelByKey = Object.fromEntries(
    interfaces.map((entry) => [entry.metricKey, entry.label]),
  );
  const sourceByKey = interfaceSourceByMetricKey(interfaces);

  return response.map((entry) => {
    const metricKey = `${entry.deviceId}:${entry.ifIndex}`;
    const row = applyInterfaceRowLinks(
      {
        deviceId: metricKey,
        deviceName: labelByKey[metricKey] ?? metricKey,
      },
      metricKey,
      String(entry.deviceId),
      sourceByKey,
    );

    for (const metric of metrics) {
      const value = findLatestValue(entry.dataPoints, metric);
      if (value != null) {
        row[metric] = value;
      }
    }

    return row;
  });
}

export function buildInterfaceTableDataFromSummary(
  response: InterfaceMetricsSummaryApiResponse[],
  metrics: string[],
  interfaces: ResolvedInterfaceSource[],
): TableRowData[] {
  const labelByKey = Object.fromEntries(
    interfaces.map((entry) => [entry.metricKey, entry.label]),
  );
  const sourceByKey = interfaceSourceByMetricKey(interfaces);

  return response.map((entry) => {
    const metricKey = `${entry.deviceId}:${entry.ifIndex}`;
    const row = applyInterfaceRowLinks(
      {
        deviceId: metricKey,
        deviceName: labelByKey[metricKey] ?? metricKey,
      },
      metricKey,
      String(entry.deviceId),
      sourceByKey,
    );

    for (const metric of metrics) {
      const value = entry.values[metric];
      if (typeof value === "number" && Number.isFinite(value)) {
        row[metric] = value;
      }
    }

    return row;
  });
}

export function buildHorizontalBarPanels(
  rows: TableRowData[],
  metrics: string[],
): HorizontalBarPanel[] {
  const maxValues = getMetricMaxValues(rows, metrics);

  return metrics.map((metric) => {
    const panelMaxRaw = maxValues[metric] ?? 0;
    const items = rows
      .map((row) => {
        const rawValue = row[metric];
        if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
          return null;
        }

        const scaled = scaleMetricForPanelDisplay(metric, rawValue, panelMaxRaw);
        return {
          id: String(row.deviceId),
          label: row.deviceName,
          rawValue,
          value: scaled.value,
          valueText: scaled.text,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item != null)
      .sort((left, right) => right.rawValue - left.rawValue)
      .map(({ id, label, value, valueText }) => ({ id, label, value, valueText }));

    return {
      id: metric,
      title: getDisplayMetricLabel(metric, maxValues[metric]),
      items,
    };
  });
}

export function hasResolvedSources(sources: {
  scope: "device" | "interface";
  deviceIds: string[];
  interfaces: ResolvedInterfaceSource[];
}): boolean {
  return sources.scope === "device"
    ? sources.deviceIds.length > 0
    : sources.interfaces.length > 0;
}
