import { useCallback, useState } from "react";
import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GaugeChartData } from "@/lib/charts.types";

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

function formatGaugeNumber(value: number, unit?: string): string {
  if (unit === "B" || unit === "bps") {
    return Math.round(value).toString();
  }

  return value.toFixed(2);
}

function GaugeDisplay({
  value,
  max,
  deviceName,
  metric,
  unit,
  thresholdWarning,
  thresholdCritical,
}: {
  value: number;
  max: number;
  deviceName: string;
  metric: string;
  unit?: string;
  thresholdWarning?: number;
  thresholdCritical?: number;
}) {
  const percentage = (value / max) * 100;

  let statusColor = "text-emerald-400";

  if (thresholdCritical && percentage >= thresholdCritical) {
    statusColor = "text-destructive";
  } else if (thresholdWarning && percentage >= thresholdWarning) {
    statusColor = "text-amber-400";
  }

  const gaugeData = [
    { name: "used", value: percentage },
    { name: "free", value: 100 - percentage },
  ];

  return (
    <div className="flex flex-col items-center space-y-4 rounded-lg border p-4">
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground">{deviceName}</p>
        <p className="text-xs text-muted-foreground">{metric}</p>
      </div>

      <div className="flex h-40 w-40 items-center justify-center">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie
              data={gaugeData}
              cx="50%"
              cy="50%"
              startAngle={180}
              endAngle={0}
              innerRadius={50}
              outerRadius={80}
              dataKey="value"
              stroke="none"
            >
              <Cell fill="var(--color-chart-1)" opacity={0.8} />
              <Cell fill="var(--color-muted)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="text-center">
        <div className={`text-2xl font-bold ${statusColor}`}>
          {formatGaugeNumber(value, unit)}
          {unit}
        </div>
        <p className="text-muted-foreground text-xs">
          of {formatGaugeNumber(max, unit)}
          {unit}
        </p>
      </div>

      {/* Threshold indicators */}
      <div className="w-full space-y-1 text-xs">
        {thresholdCritical ? (
          <p className="text-destructive">
            🔴 Critical: ≥ {formatGaugeNumber(thresholdCritical, unit)}
            {unit}
          </p>
        ) : null}
        {thresholdWarning ? (
          <p className="text-amber-400">
            🟡 Warning: ≥ {formatGaugeNumber(thresholdWarning, unit)}
            {unit}
          </p>
        ) : null}
      </div>
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
  const [availableMetrics] = useState(["cpu_usage", "memory_usage", "disk_usage", "network_utilization"]);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-6">
        {!hideControls && (
          <>
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
          </>
        )}

        {/* Gauges */}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            Loading gauge data...
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed py-12 text-sm text-muted-foreground">
            No gauge data available.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredData.map((gauge) => (
              <GaugeDisplay
                key={`${gauge.deviceId}-${gauge.metric}`}
                value={gauge.value}
                max={gauge.max}
                deviceName={gauge.deviceName}
                metric={gauge.metric}
                unit={gauge.unit}
                thresholdWarning={gauge.thresholdWarning}
                thresholdCritical={gauge.thresholdCritical}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
