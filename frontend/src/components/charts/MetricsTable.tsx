import { useState, useCallback } from "react";
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TableRowData } from "@/lib/charts.types";

interface MetricsTableProps {
  data: TableRowData[];
  metrics: string[];
  title: string;
  description?: string;
  onDeviceIdsChange?: (deviceIds: string[]) => void;
  onMetricsChange?: (metrics: string[]) => void;
  isLoading?: boolean;
  error?: string | null;
  hideControls?: boolean;
  metricLabels?: Record<string, string>;
}

export const MetricsTable = React.memo(function MetricsTable({
  data,
  metrics,
  title,
  description,
  onDeviceIdsChange,
  onMetricsChange,
  isLoading = false,
  error = null,
  hideControls = false,
  metricLabels,
}: MetricsTableProps) {
  const [deviceIds, setDeviceIds] = useState("1,2,3");
  const [activeMetrics, setActiveMetrics] = useState(metrics);

  const formatMetricHeader = (metric: string) => metricLabels?.[metric] ?? metric;

  const handleDeviceChange = useCallback(() => {
    const ids = deviceIds.split(",").map((id) => id.trim());
    if (onDeviceIdsChange) {
      onDeviceIdsChange(ids);
    }
  }, [deviceIds, onDeviceIdsChange]);

  const handleMetricToggle = useCallback(
    (metric: string) => {
      const updated = activeMetrics.includes(metric)
        ? activeMetrics.filter((m) => m !== metric)
        : [...activeMetrics, metric];
      setActiveMetrics(updated);
      if (onMetricsChange) {
        onMetricsChange(updated);
      }
    },
    [activeMetrics, onMetricsChange],
  );

  const filteredData = data.filter((row) => {
    const metricsToShow = hideControls ? metrics : activeMetrics;
    const metricsPresent = metricsToShow.some((metric) => metric in row);
    return metricsPresent;
  });

  const displayedMetrics = hideControls ? metrics : activeMetrics;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        {!hideControls ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="table-device-ids">Device IDs</Label>
                <Input
                  id="table-device-ids"
                  placeholder="1,2,3"
                  value={deviceIds}
                  onChange={(e) => setDeviceIds(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleDeviceChange} className="w-full">
                  Update Devices
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {metrics.map((metric) => (
                <Button
                  key={metric}
                  variant={activeMetrics.includes(metric) ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleMetricToggle(metric)}
                >
                  {formatMetricHeader(metric)}
                </Button>
              ))}
            </div>
          </>
        ) : null}

        {/* Table */}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Loading table data...
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed py-8 text-sm text-muted-foreground">
            No devices or metrics selected.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Device</th>
                  {displayedMetrics.map((metric) => (
                    <th key={metric} className="px-4 py-3 text-right font-medium">
                      {formatMetricHeader(metric)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredData.map((row) => (
                  <tr key={row.deviceId} className="hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium">
                      <div>
                        <p className="font-semibold">{row.deviceName}</p>
                        <p className="text-muted-foreground text-xs">ID: {row.deviceId}</p>
                      </div>
                    </td>
                    {displayedMetrics.map((metric) => (
                      <td key={metric} className="px-4 py-3 text-right">
                        {metric in row ? (
                          <span className="font-mono">
                            {typeof row[metric] === "number" ? row[metric].toFixed(2) : row[metric]}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
