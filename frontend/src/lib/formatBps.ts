import type { TimeSeriesChartData } from "@/lib/charts.types";

export type BpsDisplayUnit = "bps" | "Kbps" | "Mbps" | "Gbps";

const BPS_SCALES: Array<{ threshold: number; divisor: number; unit: BpsDisplayUnit }> = [
  { threshold: 1_000_000_000, divisor: 1_000_000_000, unit: "Gbps" },
  { threshold: 1_000_000, divisor: 1_000_000, unit: "Mbps" },
  { threshold: 1_000, divisor: 1_000, unit: "Kbps" },
];

export function getBpsDisplayScale(maxBps: number): {
  divisor: number;
  unit: BpsDisplayUnit;
} {
  if (!Number.isFinite(maxBps) || maxBps <= 0) {
    return { divisor: 1, unit: "bps" };
  }

  for (const scale of BPS_SCALES) {
    if (maxBps >= scale.threshold) {
      return { divisor: scale.divisor, unit: scale.unit };
    }
  }

  return { divisor: 1, unit: "bps" };
}

export function getMaxMetricValue(
  data: TimeSeriesChartData[],
  metrics: string[],
): number {
  let max = 0;

  for (const row of data) {
    for (const metric of metrics) {
      const value = row[metric];
      if (typeof value === "number" && Number.isFinite(value)) {
        max = Math.max(max, value);
      }
    }
  }

  return max;
}

export function scaleBpsChartData(
  data: TimeSeriesChartData[],
  metrics: string[],
): { data: TimeSeriesChartData[]; unit: BpsDisplayUnit; divisor: number } {
  const maxBps = getMaxMetricValue(data, metrics);
  const { divisor, unit } = getBpsDisplayScale(maxBps);

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

export function bpsMetricLabels(unit: BpsDisplayUnit): Record<string, string> {
  return {
    in_bps: `Inbound (${unit})`,
    out_bps: `Outbound (${unit})`,
  };
}

export function bpsMetricLabel(metricKey: string, unit: BpsDisplayUnit): string {
  return bpsMetricLabels(unit)[metricKey] ?? metricKey;
}

export function formatBpsValue(bps: number): {
  value: number;
  unit: BpsDisplayUnit;
  text: string;
} {
  const { divisor, unit } = getBpsDisplayScale(bps);
  const rawValue = bps / divisor;
  const decimals = unit === "bps" ? 0 : 2;
  const value =
    decimals === 0 ? Math.round(rawValue) : Math.round(rawValue * 100) / 100;

  return {
    value,
    unit,
    text: `${value.toFixed(decimals)} ${unit}`,
  };
}
