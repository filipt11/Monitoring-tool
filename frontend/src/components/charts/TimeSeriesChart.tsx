import { useEffect, useMemo, useState } from "react";
import React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { TimeSeriesChartData } from "@/lib/charts.types";
import { MetricsTimeRangeControl } from "./MetricsTimeRangeControl";

const DEFAULT_CHART_COLORS = [
  "oklch(0.72 0.14 245)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function formatMetricLabel(metric: string, labels?: Record<string, string>): string {
  if (labels?.[metric]) {
    return labels[metric];
  }

  return metric
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatAxisTime(timeMs: number): string {
  return new Date(timeMs).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatChartValue(value: number, decimals?: number): string {
  if (decimals != null) {
    return value.toFixed(decimals);
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function sanitizeSvgId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/** Zoom the Y axis for low-value area charts so the fill remains visible. */
function computeAreaYDomain(
  chartData: Record<string, string | number | null | undefined>[],
  activeMetrics: string[],
): [number, number] {
  const values: number[] = [];

  for (const row of chartData) {
    for (const metric of activeMetrics) {
      const value = row[metric];
      if (typeof value === "number" && Number.isFinite(value)) {
        values.push(value);
      }
    }
  }

  if (values.length === 0) {
    return [0, 100];
  }

  const sorted = [...values].sort((left, right) => left - right);
  const max = sorted[sorted.length - 1] ?? 0;
  const median = sorted[Math.floor(sorted.length / 2)] ?? max;
  const p80 = sorted[Math.floor(sorted.length * 0.8)] ?? max;

  // Low-utilization devices (e.g. r-low-1) sit near the bottom of a 0-100 axis,
  // making area fill look like a plain line. Zoom in when typical values stay low.
  if (median <= 20) {
    if (max <= 40) {
      return [0, Math.max(12, Math.ceil(max * 1.15))];
    }

    // Occasional spikes on an otherwise low device — zoom to the typical band.
    return [0, Math.max(20, Math.min(40, Math.ceil(p80 * 1.25)))];
  }

  if (max <= 40) {
    return [0, Math.max(12, Math.ceil(max * 1.15))];
  }

  return [0, Math.min(100, Math.ceil(max * 1.08))];
}

interface TimeSeriesChartProps {
  data: TimeSeriesChartData[];
  metrics: string[];
  metricLabels?: Record<string, string>;
  title: string;
  description?: string;
  initialStart: Date;
  initialEnd: Date;
  onDateRangeChange?: (start: Date, end: Date) => void;
  isLoading?: boolean;
  error?: string | null;
  showMetricToggles?: boolean;
  /** Number of decimal places for tooltip and Y-axis values. */
  valueDecimals?: number;
  /** Line/fill colors per metric. Defaults to theme chart colors (blue first). */
  colors?: string[];
  /** `auto` uses line charts for multi-metric series and area charts for a single metric. */
  chartStyle?: "auto" | "area" | "line";
  /** Unique id for SVG defs (gradients). Required when multiple charts share metrics on one page. */
  chartInstanceId?: string;
  /** When false, hides the built-in time range picker (e.g. when a parent controls range). */
  showTimeRangeControl?: boolean;
}

export const TimeSeriesChart = React.memo(function TimeSeriesChart({
  data,
  metrics,
  metricLabels,
  title,
  description,
  initialStart,
  initialEnd,
  onDateRangeChange,
  isLoading = false,
  error = null,
  showMetricToggles = true,
  valueDecimals,
  colors = DEFAULT_CHART_COLORS,
  chartStyle = "auto",
  chartInstanceId,
  showTimeRangeControl = true,
}: TimeSeriesChartProps) {
  const [activeMetrics, setActiveMetrics] = useState(metrics);

  useEffect(() => {
    setActiveMetrics(metrics);
  }, [metrics]);

  const resolvedInstanceId = sanitizeSvgId(chartInstanceId ?? title);

  const useLineChart =
    chartStyle === "line" ||
    (chartStyle === "auto" && metrics.length > 1);

  const handleMetricToggle = (metric: string) => {
    setActiveMetrics((prev) =>
      prev.includes(metric) ? prev.filter((m) => m !== metric) : [...prev, metric],
    );
  };

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return [...data]
      .sort((left, right) => left.timeMs - right.timeMs)
      .map((row) => {
        const newRow: Record<string, string | number | null | undefined> = {
          timestamp: row.timestamp,
          timeMs: row.timeMs,
        };

        activeMetrics.forEach((metric) => {
          newRow[metric] = metric in row ? (row[metric] ?? null) : null;
        });

        return newRow;
      });
  }, [data, activeMetrics]);

  const areaYDomain = useMemo(
    () => computeAreaYDomain(chartData, activeMetrics),
    [activeMetrics, chartData],
  );

  const shouldShowMetricToggles = showMetricToggles && metrics.length > 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-6">
        {showTimeRangeControl && (
          <MetricsTimeRangeControl
            idPrefix="timeseries"
            start={initialStart}
            end={initialEnd}
            onApply={(start, end) => onDateRangeChange?.(start, end)}
            disabled={isLoading}
          />
        )}

        {shouldShowMetricToggles && (
          <div className="flex flex-wrap gap-2">
            {metrics.map((metric) => (
              <Button
                key={metric}
                variant={activeMetrics.includes(metric) ? "default" : "outline"}
                size="sm"
                onClick={() => handleMetricToggle(metric)}
              >
                {formatMetricLabel(metric, metricLabels)}
              </Button>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex h-80 items-center justify-center text-muted-foreground">
            Loading chart data...
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-80 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            No data available for the selected time range and metrics.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            {useLineChart ? (
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis
                  dataKey="timeMs"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={formatAxisTime}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(value) => formatChartValue(Number(value), valueDecimals)}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                />
                <Tooltip
                  labelFormatter={(value) => formatAxisTime(Number(value))}
                  formatter={(value) => formatChartValue(Number(value), valueDecimals)}
                  contentStyle={{
                    backgroundColor: "var(--color-popover)",
                    borderColor: "var(--color-border)",
                    borderRadius: "0.5rem",
                    color: "var(--color-popover-foreground)",
                  }}
                />
                <Legend />
                {activeMetrics.map((metric, idx) => (
                  <Line
                    key={metric}
                    type="linear"
                    dataKey={metric}
                    name={formatMetricLabel(metric, metricLabels)}
                    stroke={colors[idx % colors.length]}
                    strokeWidth={2}
                    connectNulls={false}
                    isAnimationActive={false}
                    dot={false}
                  />
                ))}
              </LineChart>
            ) : (
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  {activeMetrics.map((metric, idx) => {
                    const gradientId = `gradient-${resolvedInstanceId}-${sanitizeSvgId(metric)}`;

                    return (
                    <linearGradient key={metric} id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors[idx % colors.length]} stopOpacity={0.22} />
                      <stop offset="95%" stopColor={colors[idx % colors.length]} stopOpacity={0} />
                    </linearGradient>
                    );
                  })}
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis
                  dataKey="timeMs"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={formatAxisTime}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                />
                <YAxis
                  domain={areaYDomain}
                  tickFormatter={(value) => formatChartValue(Number(value), valueDecimals)}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                />
                <Tooltip
                  labelFormatter={(value) => formatAxisTime(Number(value))}
                  formatter={(value) => formatChartValue(Number(value), valueDecimals)}
                  contentStyle={{
                    backgroundColor: "var(--color-popover)",
                    borderColor: "var(--color-border)",
                    borderRadius: "0.5rem",
                    color: "var(--color-popover-foreground)",
                  }}
                />
                <Legend />
                {activeMetrics.map((metric, idx) => {
                  const gradientId = `gradient-${resolvedInstanceId}-${sanitizeSvgId(metric)}`;

                  return (
                  <Area
                    key={metric}
                    type="linear"
                    dataKey={metric}
                    name={formatMetricLabel(metric, metricLabels)}
                    stroke={colors[idx % colors.length]}
                    fill={`url(#${gradientId})`}
                    strokeWidth={2}
                    baseValue={0}
                    connectNulls
                    isAnimationActive={false}
                    dot={false}
                  />
                  );
                })}
              </AreaChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
});
