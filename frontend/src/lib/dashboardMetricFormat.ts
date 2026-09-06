import type { DashboardChartPanel } from "@/lib/dashboardChartData";
import {
  getMetricDefinition,
  type DashboardMetricDefinition,
} from "@/lib/dashboardConfig";
import { formatPercentValue } from "@/lib/formatPercent";
import type { TimeSeriesChartData } from "@/lib/charts.types";
import {
  formatAvailabilityChartValue,
  toAvailabilityPercentScale,
} from "@/lib/formatAvailability";
import {
  bpsMetricLabel,
  bpsMetricLabels,
  formatBpsValue,
  getBpsDisplayScale,
  getMaxMetricValue,
  scaleBpsChartData,
  type BpsDisplayUnit,
} from "@/lib/formatBps";
import {
  bytesMetricLabel,
  formatBytesValue,
  getBytesDisplayScale,
  scaleBytesChartData,
  type ByteDisplayUnit,
} from "@/lib/formatBytes";

function valueDecimalsForUnit(unit: ByteDisplayUnit | BpsDisplayUnit): number {
  return unit === "B" || unit === "bps" ? 0 : 2;
}

function metricTitleWithUnit(definition: DashboardMetricDefinition, unit: string): string {
  if (definition.label.includes("(raw)")) {
    return definition.label.replace("(raw)", `(${unit})`);
  }

  if (definition.label.includes("(bps)")) {
    return definition.label.replace("(bps)", `(${unit})`);
  }

  return `${definition.label} (${unit})`;
}

export function scaleMetricForDisplay(
  metricKey: string,
  value: number,
): { value: number; unit?: string; text: string } {
  const definition = getMetricDefinition(metricKey);

  if (definition?.scaleType === "bytes") {
    const formatted = formatBytesValue(value);
    return formatted;
  }

  if (definition?.scaleType === "bps") {
    const formatted = formatBpsValue(value);
    return formatted;
  }

  if (definition?.isAvailability) {
    const percent = toAvailabilityPercentScale(value);
    return {
      value: percent,
      unit: "%",
      text: formatAvailabilityChartValue(percent),
    };
  }

  if (definition?.isPercentage) {
    return {
      value,
      unit: "%",
      text: formatPercentValue(value),
    };
  }

  const rounded = Number.isInteger(value) ? value : Math.round(value * 100) / 100;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return { value: rounded, text };
}

/** Scale values with one unit per panel so bar lengths stay comparable. */
export function scaleMetricForPanelDisplay(
  metricKey: string,
  value: number,
  panelMaxValue: number,
): { value: number; unit?: string; text: string } {
  const definition = getMetricDefinition(metricKey);

  if (definition?.scaleType === "bytes") {
    const { divisor, unit } = getBytesDisplayScale(panelMaxValue);
    const rawScaled = value / divisor;
    const decimals = unit === "B" ? 0 : 2;
    const scaledValue =
      decimals === 0 ? Math.round(rawScaled) : Math.round(rawScaled * 100) / 100;

    return {
      value: scaledValue,
      unit,
      text: `${scaledValue.toFixed(decimals)} ${unit}`,
    };
  }

  if (definition?.scaleType === "bps") {
    const { divisor, unit } = getBpsDisplayScale(panelMaxValue);
    const rawScaled = value / divisor;
    const decimals = unit === "bps" ? 0 : 2;
    const scaledValue =
      decimals === 0 ? Math.round(rawScaled) : Math.round(rawScaled * 100) / 100;

    return {
      value: scaledValue,
      unit,
      text: `${scaledValue.toFixed(decimals)} ${unit}`,
    };
  }

  return scaleMetricForDisplay(metricKey, value);
}

export function getDisplayMetricLabel(metricKey: string, maxValue?: number): string {
  const definition = getMetricDefinition(metricKey);
  if (!definition) {
    return metricKey;
  }

  if (definition.scaleType === "bytes") {
    const unit = getBytesDisplayScale(maxValue ?? 0).unit;
    return bytesMetricLabel(unit);
  }

  if (definition.scaleType === "bps") {
    const unit = formatBpsValue(maxValue ?? 0).unit;
    return bpsMetricLabel(metricKey, unit);
  }

  return definition.label;
}

function scaleAvailabilityChartData(
  data: TimeSeriesChartData[],
  keys: string[],
): TimeSeriesChartData[] {
  return data.map((row) => {
    const scaled: TimeSeriesChartData = { ...row };

    for (const key of keys) {
      const value = row[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        scaled[key] = toAvailabilityPercentScale(value);
      }
    }

    return scaled;
  });
}

export function scaleDashboardChartPanel(panel: DashboardChartPanel): DashboardChartPanel {
  const panelDefinition = getMetricDefinition(panel.id);

  if (panelDefinition?.scaleType === "bytes") {
    const { data, unit } = scaleBytesChartData(panel.data, panel.seriesKeys);
    return {
      ...panel,
      data,
      title: bytesMetricLabel(unit),
      valueDecimals: valueDecimalsForUnit(unit),
    };
  }

  if (panelDefinition?.scaleType === "bps") {
    const { data, unit } = scaleBpsChartData(panel.data, panel.seriesKeys);
    return {
      ...panel,
      data,
      title: metricTitleWithUnit(panelDefinition, unit),
      valueDecimals: valueDecimalsForUnit(unit),
    };
  }

  let result = panel;

  const byteKeys = result.seriesKeys.filter(
    (key) => getMetricDefinition(key)?.scaleType === "bytes",
  );

  if (byteKeys.length > 0) {
    const { data, unit } = scaleBytesChartData(result.data, byteKeys);
    const metricLabels = { ...result.metricLabels };

    for (const key of byteKeys) {
      metricLabels[key] = bytesMetricLabel(unit);
    }

    result = {
      ...result,
      data,
      metricLabels,
      valueDecimals: result.valueDecimals ?? valueDecimalsForUnit(unit),
    };
  }

  const bpsKeys = result.seriesKeys.filter(
    (key) => getMetricDefinition(key)?.scaleType === "bps",
  );

  if (bpsKeys.length > 0) {
    const { data, unit } = scaleBpsChartData(result.data, bpsKeys);

    result = {
      ...result,
      data,
      metricLabels: { ...result.metricLabels, ...bpsMetricLabels(unit) },
      valueDecimals: result.valueDecimals ?? valueDecimalsForUnit(unit),
    };
  }

  const availabilityKeys = result.seriesKeys.filter(
    (key) => getMetricDefinition(key)?.isAvailability === true,
  );

  if (availabilityKeys.length > 0) {
    result = {
      ...result,
      data: scaleAvailabilityChartData(result.data, availabilityKeys),
      valueDecimals: result.valueDecimals ?? 2,
    };
  }

  return result;
}

export function getDisplayMetricLabels(
  metrics: string[],
  maxValues: Record<string, number>,
): Record<string, string> {
  return Object.fromEntries(
    metrics.map((metric) => [metric, getDisplayMetricLabel(metric, maxValues[metric])]),
  );
}

export function getMetricMaxValues(
  rows: Array<Record<string, string | number>>,
  metrics: string[],
): Record<string, number> {
  return Object.fromEntries(
    metrics.map((metric) => [
      metric,
      rows.reduce((max, row) => {
        const value = row[metric];
        return typeof value === "number" && Number.isFinite(value) ? Math.max(max, value) : max;
      }, 0),
    ]),
  );
}

export function getPanelFormatValue(
  panel: DashboardChartPanel,
): ((value: number) => string) | undefined {
  if (panel.seriesKeys.length === 0) {
    return undefined;
  }

  const allAvailability = panel.seriesKeys.every(
    (key) => getMetricDefinition(key)?.isAvailability === true,
  );

  if (allAvailability) {
    return (value) => formatAvailabilityChartValue(value);
  }

  const allPercentages = panel.seriesKeys.every(
    (key) => getMetricDefinition(key)?.isPercentage === true,
  );

  if (!allPercentages) {
    return undefined;
  }

  return (value) => formatPercentValue(value);
}

export function getPanelYDomain(
  panel: DashboardChartPanel,
): [number, number] | undefined {
  if (panel.seriesKeys.length === 0) {
    return undefined;
  }

  const allAvailability = panel.seriesKeys.every(
    (key) => getMetricDefinition(key)?.isAvailability === true,
  );

  return allAvailability ? [0, 100] : undefined;
}

export function shouldPanelUseStepLine(panel: DashboardChartPanel): boolean {
  if (panel.seriesKeys.length === 0) {
    return false;
  }

  return panel.seriesKeys.every((key) => getMetricDefinition(key)?.isAvailability === true);
}

export function getPanelMetricMaxValue(panel: DashboardChartPanel): number {
  return getMaxMetricValue(panel.data, panel.seriesKeys);
}
