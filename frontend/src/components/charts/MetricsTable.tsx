import { useState, useCallback, useMemo } from "react";
import React from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TableRowData } from "@/lib/charts.types";
import { routes } from "@/lib/routes";

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
  formatMetricValue?: (metric: string, value: number) => string;
}

type SortKey = "device" | "interface" | string;
type SortDirection = "asc" | "desc";

function isInterfaceTableRow(row: TableRowData): boolean {
  return row.interfaceId != null;
}

function getRowDeviceLabel(row: TableRowData): string {
  if (row.deviceLabel) {
    return row.deviceLabel;
  }

  const separator = " / ";
  const splitIndex = row.deviceName.indexOf(separator);
  if (splitIndex >= 0) {
    return row.deviceName.slice(0, splitIndex);
  }

  return row.deviceName;
}

function getRowInterfaceLabel(row: TableRowData): string {
  if (row.interfaceName) {
    return row.interfaceName;
  }

  const separator = " / ";
  const splitIndex = row.deviceName.indexOf(separator);
  if (splitIndex >= 0) {
    return row.deviceName.slice(splitIndex + separator.length);
  }

  return row.deviceName;
}

function getRowLinkDeviceId(row: TableRowData): string {
  return row.linkDeviceId ?? row.deviceId;
}

function getMetricValue(row: TableRowData, metric: string): number | null {
  const value = row[metric];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "—") {
      return null;
    }

    const match = trimmed.match(/^-?\d+(?:\.\d+)?/);
    if (match) {
      return Number.parseFloat(match[0]);
    }
  }

  return null;
}

function compareRows(
  left: TableRowData,
  right: TableRowData,
  sortKey: SortKey,
  direction: SortDirection,
): number {
  const multiplier = direction === "asc" ? 1 : -1;

  if (sortKey === "device") {
    const leftLabel = isInterfaceTableRow(left) ? getRowDeviceLabel(left) : left.deviceName;
    const rightLabel = isInterfaceTableRow(right) ? getRowDeviceLabel(right) : right.deviceName;

    return multiplier * leftLabel.localeCompare(rightLabel, undefined, { sensitivity: "base" });
  }

  if (sortKey === "interface") {
    return (
      multiplier *
      getRowInterfaceLabel(left).localeCompare(getRowInterfaceLabel(right), undefined, {
        sensitivity: "base",
      })
    );
  }

  const leftValue = getMetricValue(left, sortKey);
  const rightValue = getMetricValue(right, sortKey);

  if (leftValue == null && rightValue == null) {
    return 0;
  }
  if (leftValue == null) {
    return 1;
  }
  if (rightValue == null) {
    return -1;
  }

  return multiplier * (leftValue - rightValue);
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
  formatMetricValue,
}: MetricsTableProps) {
  const [deviceIds, setDeviceIds] = useState("1,2,3");
  const [activeMetrics, setActiveMetrics] = useState(metrics);
  const [sortKey, setSortKey] = useState<SortKey>("device");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const formatMetricHeader = (metric: string) => metricLabels?.[metric] ?? metric;

  const formatCellValue = (metric: string, value: string | number) => {
    if (typeof value === "number" && formatMetricValue) {
      return formatMetricValue(metric, value);
    }

    if (typeof value === "number") {
      return value.toFixed(2);
    }

    return value;
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return null;
    }

    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 size-3" />
    ) : (
      <ArrowDown className="ml-1 size-3" />
    );
  };

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

  const sortedData = useMemo(
    () =>
      [...filteredData].sort((left, right) => compareRows(left, right, sortKey, sortDirection)),
    [filteredData, sortDirection, sortKey],
  );

  const displayedMetrics = hideControls ? metrics : activeMetrics;
  const showInterfaceColumns = data.some(isInterfaceTableRow);

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
                  {showInterfaceColumns ? (
                    <>
                      <th className="px-4 py-3 text-left font-medium">
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground flex items-center"
                          onClick={() => toggleSort("interface")}
                        >
                          Interface
                          {renderSortIcon("interface")}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left font-medium">
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground flex items-center"
                          onClick={() => toggleSort("device")}
                        >
                          Device
                          {renderSortIcon("device")}
                        </button>
                      </th>
                    </>
                  ) : (
                    <th className="px-4 py-3 text-left font-medium">
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground flex items-center"
                        onClick={() => toggleSort("device")}
                      >
                        Device
                        {renderSortIcon("device")}
                      </button>
                    </th>
                  )}
                  {displayedMetrics.map((metric) => (
                    <th key={metric} className="px-4 py-3 text-right font-medium">
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground ml-auto flex items-center justify-end"
                        onClick={() => toggleSort(metric)}
                      >
                        {formatMetricHeader(metric)}
                        {renderSortIcon(metric)}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedData.map((row) => (
                  <tr key={row.deviceId} className="hover:bg-muted/40">
                    {showInterfaceColumns ? (
                      <>
                        <td className="px-4 py-3 font-medium">
                          {row.interfaceId ? (
                            <Button
                              variant="link"
                              className="h-auto p-0 text-sm font-semibold"
                              asChild
                            >
                              <Link to={routes.interfaceDetails(row.interfaceId)}>
                                {getRowInterfaceLabel(row)}
                              </Link>
                            </Button>
                          ) : (
                            getRowInterfaceLabel(row)
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          <Button
                            variant="link"
                            className="h-auto p-0 text-sm font-semibold"
                            asChild
                          >
                            <Link to={routes.deviceDetails(getRowLinkDeviceId(row))}>
                              {getRowDeviceLabel(row)}
                            </Link>
                          </Button>
                        </td>
                      </>
                    ) : (
                      <td className="px-4 py-3 font-medium">
                        <Button variant="link" className="h-auto p-0 text-sm font-semibold" asChild>
                          <Link to={routes.deviceDetails(getRowLinkDeviceId(row))}>
                            {row.deviceName}
                          </Link>
                        </Button>
                      </td>
                    )}
                    {displayedMetrics.map((metric) => (
                      <td key={metric} className="px-4 py-3 text-right">
                        {metric in row ? (
                          <span className="font-mono">{formatCellValue(metric, row[metric])}</span>
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
