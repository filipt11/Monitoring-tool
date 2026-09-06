import type { TimeSeriesChartData } from "@/lib/charts.types";

import { getMaxMetricValue } from "@/lib/formatBps";

export type ByteDisplayUnit = "B" | "KB" | "MB" | "GB" | "TB";

const BYTE_SCALES: Array<{ threshold: number; divisor: number; unit: ByteDisplayUnit }> = [
  { threshold: 1024 ** 4, divisor: 1024 ** 4, unit: "TB" },
  { threshold: 1024 ** 3, divisor: 1024 ** 3, unit: "GB" },
  { threshold: 1024 ** 2, divisor: 1024 ** 2, unit: "MB" },
  { threshold: 1024, divisor: 1024, unit: "KB" },
];

export function getBytesDisplayScale(maxBytes: number): {
  divisor: number;
  unit: ByteDisplayUnit;
} {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    return { divisor: 1, unit: "B" };
  }

  for (const scale of BYTE_SCALES) {
    if (maxBytes >= scale.threshold) {
      return { divisor: scale.divisor, unit: scale.unit };
    }
  }

  return { divisor: 1, unit: "B" };
}

export function scaleBytesChartData(
  data: TimeSeriesChartData[],
  metrics: string[],
): { data: TimeSeriesChartData[]; unit: ByteDisplayUnit; divisor: number } {
  const maxBytes = getMaxMetricValue(data, metrics);
  const { divisor, unit } = getBytesDisplayScale(maxBytes);

  if (divisor === 1) {
    return { data, unit, divisor };
  }

  const scaled = data.map((row) => {
    const next: TimeSeriesChartData = { ...row };

    for (const metric of metrics) {
      const value = row[metric];
      if (typeof value === "number") {
        next[metric] = value / divisor;
      }
    }

    return next;
  });

  return { data: scaled, unit, divisor };
}

export function bytesMetricLabel(unit: ByteDisplayUnit): string {
  return `Memory usage (${unit})`;
}

export function formatBytesValue(bytes: number): {
  value: number;
  unit: ByteDisplayUnit;
  text: string;
} {
  const { divisor, unit } = getBytesDisplayScale(bytes);
  const rawValue = bytes / divisor;
  const decimals = unit === "B" ? 0 : 2;
  const value =
    decimals === 0 ? Math.round(rawValue) : Math.round(rawValue * 100) / 100;

  return {
    value,
    unit,
    text: `${value.toFixed(decimals)} ${unit}`,
  };
}
