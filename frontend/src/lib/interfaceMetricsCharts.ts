import type { TimeSeriesChartData } from "@/lib/charts.types";
import { formatAppChartDateTime } from "@/lib/dateFormat";
import type { MetricPointApi } from "@/lib/metricsApi";

export const INTERFACE_UTIL_METRICS = ["in_util_pct", "out_util_pct"] as const;
export const INTERFACE_SPEED_METRICS = ["in_bps", "out_bps"] as const;
export const INTERFACE_ALL_METRICS = [
  ...INTERFACE_UTIL_METRICS,
  ...INTERFACE_SPEED_METRICS,
] as const;
export const INTERFACE_CHART_COLORS = ["#38bdf8", "#db2777"];

function formatChartTimestamp(date: Date): string {
  return formatAppChartDateTime(date);
}

export function buildInterfaceUtilChartData(
  dataPoints: MetricPointApi[],
): TimeSeriesChartData[] {
  return dataPoints
    .flatMap((point) => {
      const inUtil = point.values?.in_util_pct;
      const outUtil = point.values?.out_util_pct;

      if (inUtil == null && outUtil == null) {
        return [];
      }

      const timestamp = new Date(point.timestamp);
      return [
        {
          timeMs: timestamp.getTime(),
          timestamp: formatChartTimestamp(timestamp),
          in_util_pct: inUtil ?? null,
          out_util_pct: outUtil ?? null,
        },
      ];
    })
    .sort((left, right) => left.timeMs - right.timeMs);
}

export function buildInterfaceSpeedChartData(
  dataPoints: MetricPointApi[],
): TimeSeriesChartData[] {
  return dataPoints
    .flatMap((point) => {
      const inBps = point.values?.in_bps;
      const outBps = point.values?.out_bps;

      if (inBps == null && outBps == null) {
        return [];
      }

      const timestamp = new Date(point.timestamp);
      return [
        {
          timeMs: timestamp.getTime(),
          timestamp: formatChartTimestamp(timestamp),
          in_bps: inBps != null ? Math.round(inBps) : null,
          out_bps: outBps != null ? Math.round(outBps) : null,
        },
      ];
    })
    .sort((left, right) => left.timeMs - right.timeMs);
}
