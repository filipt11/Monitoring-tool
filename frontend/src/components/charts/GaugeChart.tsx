import { useCallback, useId, useState } from "react";
import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GaugeChartData } from "@/lib/charts.types";
import { cn } from "@/lib/utils";

interface GaugeChartProps {
  data: GaugeChartData[];
  title: string;
  description?: string;
  onDeviceIdsChange?: (deviceIds: string[]) => void;
  onMetricsChange?: (metrics: string[]) => void;
  isLoading?: boolean;
  error?: string | null;
  hideControls?: boolean;
}

function formatGaugeDisplayValue(value: number, unit?: string, valueText?: string): string {
  if (valueText) {
    return valueText;
  }

  if (unit === "B" || unit === "bps") {
    return `${Math.round(value)}${unit ?? ""}`;
  }

  if (unit === "%") {
    return `${value.toFixed(2)}%`;
  }

  return unit ? `${value.toFixed(2)}${unit}` : value.toFixed(2);
}

function resolveGaugeArcColor(
  percentage: number,
  thresholdWarning?: number,
  thresholdCritical?: number,
): { fill?: string; useGradient: boolean; valueClass: string } {
  if (thresholdCritical && percentage >= thresholdCritical) {
    return { fill: "var(--color-destructive)", useGradient: false, valueClass: "text-destructive" };
  }

  if (thresholdWarning && percentage >= thresholdWarning) {
    return { fill: "#f59e0b", useGradient: false, valueClass: "text-amber-400" };
  }

  return { useGradient: true, valueClass: "text-foreground" };
}

function GaugeDisplay({
  value,
  max,
  deviceName,
  metric,
  unit,
  valueText,
  maxText,
  thresholdWarning,
  thresholdCritical,
}: {
  value: number;
  max: number;
  deviceName: string;
  metric: string;
  unit?: string;
  valueText?: string;
  maxText?: string;
  thresholdWarning?: number;
  thresholdCritical?: number;
}) {
  const gradientId = useId().replace(/:/g, "");
  const safeMax = max > 0 ? max : 1;
  const percentage = Math.min((value / safeMax) * 100, 100);
  const { fill, useGradient, valueClass } = resolveGaugeArcColor(
    percentage,
    thresholdWarning,
    thresholdCritical,
  );

  const gaugeData = [
    { name: "used", value: percentage },
    { name: "free", value: 100 - percentage },
  ];

  const displayValue = formatGaugeDisplayValue(value, unit, valueText);
  const displayMax = formatGaugeDisplayValue(max, unit, maxText);

  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-sm">
      <div className="px-4 pt-3 pb-1">
        <p className="text-sm leading-none font-semibold">{deviceName}</p>
        <p className="text-muted-foreground mt-1 text-xs">{metric}</p>
      </div>

      <div className="flex justify-center px-2">
        <div className="w-[90%]">
          {/* Clip to arc band only — inner chart stays full 2:1 size (same gauge as before). */}
          <div className="relative aspect-[4/1] w-full overflow-hidden">
            <div className="absolute inset-x-0 bottom-0 aspect-[2/1] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="var(--color-chart-1)" />
                      <stop offset="100%" stopColor="var(--color-chart-2)" />
                    </linearGradient>
                  </defs>
                  <Pie
                    data={gaugeData}
                    cx="50%"
                    cy="100%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius="68%"
                    outerRadius="100%"
                    dataKey="value"
                    stroke="none"
                    paddingAngle={0}
                    cornerRadius={10}
                  >
                    <Cell fill={useGradient ? `url(#${gradientId})` : fill} />
                    <Cell fill="var(--color-muted)" fillOpacity={0.3} />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-1 pb-3 text-center">
        <p className={cn("text-2xl leading-none font-bold tracking-tight", valueClass)}>
          {displayValue}
        </p>
        <p className="text-muted-foreground mt-1 text-xs leading-snug">
          of {displayMax} · mean over selected period
        </p>
      </div>
    </Card>
  );
}

function GaugeChartBody({
  data,
  isLoading,
  error,
}: {
  data: GaugeChartData[];
  isLoading: boolean;
  error: string | null;
}) {
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center text-muted-foreground">
        Loading gauge data...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        No gauge data available.
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {data.map((gauge) => (
        <GaugeDisplay
          key={`${gauge.deviceId}-${gauge.metric}`}
          value={gauge.value}
          max={gauge.max}
          deviceName={gauge.deviceName}
          metric={gauge.metric}
          unit={gauge.unit}
          valueText={gauge.valueText}
          maxText={gauge.maxText}
          thresholdWarning={gauge.thresholdWarning}
          thresholdCritical={gauge.thresholdCritical}
        />
      ))}
    </div>
  );
}

export const GaugeChart = React.memo(function GaugeChart({
  data,
  title,
  description,
  onDeviceIdsChange,
  onMetricsChange,
  isLoading = false,
  error = null,
  hideControls = false,
}: GaugeChartProps) {
  const [deviceIds, setDeviceIds] = useState("1,2");
  const [metrics, setMetrics] = useState("memory_usage,cpu_usage");
  const [availableMetrics] = useState([
    "cpu_usage",
    "memory_usage",
    "disk_usage",
    "network_utilization",
  ]);

  const handleDeviceChange = useCallback(() => {
    const ids = deviceIds.split(",").map((id) => id.trim());
    if (onDeviceIdsChange) {
      onDeviceIdsChange(ids);
    }
  }, [deviceIds, onDeviceIdsChange]);

  const handleMetricChange = useCallback(() => {
    const selectedMetrics = metrics.split(",").map((m) => m.trim());
    if (onMetricsChange) {
      onMetricsChange(selectedMetrics);
    }
  }, [metrics, onMetricsChange]);

  const filteredData = data.length > 0 ? data : [];

  if (hideControls) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          {description ? (
            <p className="text-muted-foreground mt-1 text-sm">{description}</p>
          ) : null}
        </div>

        <GaugeChartBody data={filteredData} isLoading={isLoading} error={error} />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="gauge-device-ids">Device IDs</Label>
            <Input
              id="gauge-device-ids"
              placeholder="1,2"
              value={deviceIds}
              onChange={(e) => setDeviceIds(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gauge-metrics">Metrics</Label>
            <Input
              id="gauge-metrics"
              placeholder="memory_usage,cpu_usage"
              value={metrics}
              onChange={(e) => setMetrics(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={handleDeviceChange} className="flex-1">
              Apply Devices
            </Button>
            <Button onClick={handleMetricChange} className="flex-1">
              Apply Metrics
            </Button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          <p className="font-medium">Available metrics:</p>
          <p>{availableMetrics.join(", ")}</p>
        </div>

        <GaugeChartBody data={filteredData} isLoading={isLoading} error={error} />
      </CardContent>
    </Card>
  );
});
