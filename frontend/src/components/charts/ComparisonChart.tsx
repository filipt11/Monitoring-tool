import { useCallback, useState } from "react";
import React from "react";
import {
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ComparisonChartData } from "@/lib/charts.types";

const COLORS = ["#8b5cf6", "#ec4899", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#84cc16"];

interface ComparisonChartProps {
  data: ComparisonChartData[];
  metric: string;
  deviceNames: string[];
  title: string;
  description?: string;
  onDateRangeChange?: (start: Date, end: Date) => void;
  isLoading?: boolean;
  error?: string | null;
}

export const ComparisonChart = React.memo(function ComparisonChart({
  data,
  deviceNames,
  title,
  description,
  onDateRangeChange,
  isLoading = false,
  error = null,
}: ComparisonChartProps) {
  const [startDate, setStartDate] = useState(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [visibleDevices, setVisibleDevices] = useState(new Set(deviceNames));

  const handleDateRangeChange = useCallback(() => {
    if (onDateRangeChange) {
      onDateRangeChange(new Date(startDate), new Date(endDate));
    }
  }, [startDate, endDate, onDateRangeChange]);

  const toggleDeviceVisibility = useCallback((deviceName: string) => {
    setVisibleDevices((prev) => {
      const updated = new Set(prev);
      if (updated.has(deviceName)) {
        updated.delete(deviceName);
      } else {
        updated.add(deviceName);
      }
      return updated;
    });
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Controls */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="comp-start-date">Start Date</Label>
            <Input
              id="comp-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comp-end-date">End Date</Label>
            <Input
              id="comp-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleDateRangeChange} className="w-full">
              Update
            </Button>
          </div>
        </div>

        {/* Device toggles */}
        <div className="space-y-2">
          <Label>Visible Devices</Label>
          <div className="flex flex-wrap gap-2">
            {deviceNames.map((deviceName) => (
              <Button
                key={deviceName}
                variant={visibleDevices.has(deviceName) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleDeviceVisibility(deviceName)}
              >
                {deviceName}
              </Button>
            ))}
          </div>
        </div>

        {/* Chart */}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex h-80 items-center justify-center text-muted-foreground">
            Loading comparison chart...
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-80 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            No data available for the selected devices and metric.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="timestamp" tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
              <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-popover)",
                  borderColor: "var(--color-border)",
                  borderRadius: "0.5rem",
                  color: "var(--color-popover-foreground)",
                }}
              />
              <Legend />
              {deviceNames
                .filter((name) => visibleDevices.has(name))
                .map((deviceName, idx) => (
                  <Line
                    key={deviceName}
                    type="monotone"
                    dataKey={deviceName}
                    stroke={COLORS[idx % COLORS.length]}
                    dot={false}
                    isAnimationActive={false}
                    strokeWidth={2}
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
});
