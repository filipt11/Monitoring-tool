import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp } from "lucide-react";
import { Link } from "react-router-dom";

import { MetricsTimeRangeControl } from "@/components/charts/MetricsTimeRangeControl";
import { StyledCheckbox } from "@/components/admin/StyledCheckbox";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ANOMALY_DETECTORS,
  ANOMALY_METRICS,
  anomalyDetectorLabel,
  anomalyMetricLabel,
  createDefaultAnomaliesRange,
  fetchAnomalies,
  formatAnomalyValue,
  type AnomalyDetector,
  type AnomalyItem,
  type AnomalyMetric,
} from "@/lib/anomaliesApi";
import { formatAppDateTime } from "@/lib/dateFormat";
import { fetchDeviceList } from "@/lib/devicesApi";
import { fetchInterfaceCatalog } from "@/lib/interfaceGroupsApi";
import { routes } from "@/lib/routes";
import type { TimeRangeApplyMeta } from "@/lib/timeRangePresets";
import { cn } from "@/lib/utils";

type SortKey =
  | "startTime"
  | "hostname"
  | "ifName"
  | "metric"
  | "detector"
  | "peakValue";
type SortDirection = "asc" | "desc";

const PAGE_SIZE = 15;

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return formatAppDateTime(date, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function isSameInstant(left: string, right: string): boolean {
  return new Date(left).getTime() === new Date(right).getTime();
}

function formatValueCell(item: AnomalyItem): string {
  if (item.sampleCount > 1 && item.peakValue !== item.value) {
    return `${formatAnomalyValue(item.metric, item.value)} (peak ${formatAnomalyValue(item.metric, item.peakValue)})`;
  }
  return formatAnomalyValue(item.metric, item.peakValue);
}

function validateRange(start: Date, end: Date): string | null {
  if (end.getTime() <= start.getTime()) {
    return "End time must be after start time.";
  }
  return null;
}

export function AnomaliesPage() {
  const defaultRange = useMemo(() => createDefaultAnomaliesRange(), []);
  const [rangeStart, setRangeStart] = useState(defaultRange.start);
  const [rangeEnd, setRangeEnd] = useState(defaultRange.end);
  const [refreshToken, setRefreshToken] = useState(0);
  const [selectedMetrics, setSelectedMetrics] = useState<AnomalyMetric[]>(["cpu_usage"]);
  const [selectedDetectors, setSelectedDetectors] = useState<AnomalyDetector[]>([...ANOMALY_DETECTORS]);
  const [hostnameFilter, setHostnameFilter] = useState("");
  const [appliedHostname, setAppliedHostname] = useState<string | undefined>(undefined);

  const [items, setItems] = useState<AnomalyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("startTime");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);

  const [deviceIdByHostname, setDeviceIdByHostname] = useState<Map<string, string>>(new Map());
  const [interfaceIdByKey, setInterfaceIdByKey] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let active = true;

    async function loadLookups() {
      try {
        const [{ devices }, interfaces] = await Promise.all([
          fetchDeviceList(),
          fetchInterfaceCatalog(0, 5000),
        ]);

        if (!active) return;

        const nextDevices = new Map<string, string>();
        devices.forEach((device) => {
          nextDevices.set(device.hostname.toLowerCase(), String(device.id));
        });

        const nextInterfaces = new Map<string, string>();
        interfaces.content.forEach((iface) => {
          const key = `${iface.deviceHostname.toLowerCase()}::${iface.name.toLowerCase()}`;
          nextInterfaces.set(key, String(iface.id));
        });

        setDeviceIdByHostname(nextDevices);
        setInterfaceIdByKey(nextInterfaces);
      } catch (lookupError) {
        if (import.meta.env.DEV) {
          console.warn("Anomaly link lookups unavailable", lookupError);
        }
      }
    }

    void loadLookups();

    return () => {
      active = false;
    };
  }, []);

  const loadAnomalies = useCallback(async () => {
    const rangeError = validateRange(rangeStart, rangeEnd);
    if (rangeError) {
      setError(rangeError);
      setItems([]);
      setLoading(false);
      return;
    }

    if (selectedMetrics.length === 0 || selectedDetectors.length === 0) {
      setError("Select at least one metric and one detection type.");
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetchAnomalies({
        start: rangeStart,
        end: rangeEnd,
        metrics: selectedMetrics,
        detectors: selectedDetectors,
        hostname: appliedHostname,
        mergeCusumEpisodes: true,
      });
      setItems(response.items ?? []);
      setCurrentPage(1);
    } catch (fetchError) {
      setItems([]);
      setError(
        fetchError instanceof Error ? fetchError.message : "Failed to load anomalies.",
      );
    } finally {
      setLoading(false);
    }
  }, [appliedHostname, rangeEnd, rangeStart, refreshToken, selectedDetectors, selectedMetrics]);

  useEffect(() => {
    void loadAnomalies();
  }, [loadAnomalies]);

  const handleRangeApply = useCallback((start: Date, end: Date, meta?: TimeRangeApplyMeta) => {
    const rangeError = validateRange(start, end);
    if (rangeError) {
      setError(rangeError);
      return;
    }
    setRangeStart(start);
    setRangeEnd(end);
    if (meta?.refreshToken != null) {
      setRefreshToken(meta.refreshToken);
    }
  }, []);

  const toggleMetric = (metric: AnomalyMetric) => {
    setSelectedMetrics((current) =>
      current.includes(metric)
        ? current.filter((entry) => entry !== metric)
        : [...current, metric],
    );
  };

  const toggleDetector = (detector: AnomalyDetector) => {
    setSelectedDetectors((current) =>
      current.includes(detector)
        ? current.filter((entry) => entry !== detector)
        : [...current, detector],
    );
  };

  const sortedItems = useMemo(() => {
    const copy = [...items];
    copy.sort((left, right) => {
      let comparison = 0;
      switch (sortKey) {
        case "startTime":
          comparison =
            new Date(left.startTime).getTime() - new Date(right.startTime).getTime();
          break;
        case "hostname":
          comparison = left.hostname.localeCompare(right.hostname);
          break;
        case "ifName":
          comparison = (left.ifName ?? "").localeCompare(right.ifName ?? "");
          break;
        case "metric":
          comparison = left.metric.localeCompare(right.metric);
          break;
        case "detector":
          comparison = left.detector.localeCompare(right.detector);
          break;
        case "peakValue":
          comparison = left.peakValue - right.peakValue;
          break;
        default:
          comparison = 0;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return copy;
  }, [items, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / PAGE_SIZE));
  const pageItems = sortedItems.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "startTime" ? "desc" : "asc");
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDirection === "asc" ? (
      <ArrowUp className="size-3.5" />
    ) : (
      <ArrowDown className="size-3.5" />
    );
  };

  const resolveDeviceLink = (hostname: string) => {
    const deviceId = deviceIdByHostname.get(hostname.toLowerCase());
    if (!deviceId) return hostname;
    return (
      <Link
        to={routes.deviceDetails(deviceId)}
        className="font-medium text-primary hover:underline"
      >
        {hostname}
      </Link>
    );
  };

  const resolveInterfaceCell = (item: AnomalyItem) => {
    if (!item.ifName) {
      return "—";
    }
    const key = `${item.hostname.toLowerCase()}::${item.ifName.toLowerCase()}`;
    const interfaceId = interfaceIdByKey.get(key);
    if (!interfaceId) {
      return item.ifName;
    }
    return (
      <Link
        to={routes.interfaceDetails(interfaceId)}
        className="text-primary hover:underline"
      >
        {item.ifName}
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-400" />
            Time range
          </CardTitle>
          <CardDescription>
            Detection always uses a fixed 12h context ending at the selected end time; the table
            only shows events that overlap your chosen range.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MetricsTimeRangeControl
            idPrefix="anomalies"
            start={rangeStart}
            end={rangeEnd}
            onApply={handleRangeApply}
            disabled={loading}
            isRefreshing={loading}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Narrow results by hostname, metric, or detection method. Point alerts are single-timestamp
            spikes; sustained alerts are grouped CUSUM episodes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="anomalies-hostname">Hostname</Label>
              <Input
                id="anomalies-hostname"
                placeholder="Substring match, e.g. low or s-low"
                value={hostnameFilter}
                onChange={(event) => setHostnameFilter(event.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAppliedHostname(hostnameFilter.trim() || undefined)}
              disabled={loading}
            >
              Apply hostname
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <Label>Metrics</Label>
              <div className="flex flex-col gap-2">
                {ANOMALY_METRICS.map((metric) => (
                  <StyledCheckbox
                    key={metric}
                    id={`anomaly-metric-${metric}`}
                    label={anomalyMetricLabel(metric)}
                    checked={selectedMetrics.includes(metric)}
                    onChange={() => toggleMetric(metric)}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Label>Detection type</Label>
              <div className="flex flex-col gap-2">
                {ANOMALY_DETECTORS.map((detector) => (
                  <StyledCheckbox
                    key={detector}
                    id={`anomaly-detector-${detector}`}
                    label={
                      detector === "ewma"
                        ? "Point (EWMA) — spikes / drops"
                        : "Sustained (CUSUM) — level shifts"
                    }
                    checked={selectedDetectors.includes(detector)}
                    onChange={() => toggleDetector(detector)}
                  />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detected anomalies</CardTitle>
          <CardDescription>
            {loading
              ? "Loading…"
              : `${sortedItems.length} event${sortedItems.length === 1 ? "" : "s"} in the selected range`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}

          {!error && !loading && sortedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No anomalies matched your filters for this time range.
            </p>
          ) : null}

          {(loading || sortedItems.length > 0) && !error ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => handleSort("startTime")}
                      >
                        From {renderSortIcon("startTime")}
                      </button>
                    </th>
                    <th className="px-3 py-2 font-medium">To</th>
                    <th className="px-3 py-2 font-medium">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => handleSort("hostname")}
                      >
                        Device {renderSortIcon("hostname")}
                      </button>
                    </th>
                    <th className="px-3 py-2 font-medium">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => handleSort("ifName")}
                      >
                        Interface {renderSortIcon("ifName")}
                      </button>
                    </th>
                    <th className="px-3 py-2 font-medium">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => handleSort("metric")}
                      >
                        Metric {renderSortIcon("metric")}
                      </button>
                    </th>
                    <th className="px-3 py-2 font-medium">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => handleSort("peakValue")}
                      >
                        Value {renderSortIcon("peakValue")}
                      </button>
                    </th>
                    <th className="px-3 py-2 font-medium">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => handleSort("detector")}
                      >
                        Type {renderSortIcon("detector")}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 5 }).map((_, index) => (
                        <tr key={`skeleton-${index}`} className="border-b border-border/60">
                          <td colSpan={7} className="px-3 py-3 text-muted-foreground">
                            Loading…
                          </td>
                        </tr>
                      ))
                    : pageItems.map((item, index) => (
                        <tr
                          key={`${item.detector}-${item.metric}-${item.hostname}-${item.startTime}-${index}`}
                          className="border-b border-border/60 hover:bg-muted/20"
                        >
                          <td className="px-3 py-2 whitespace-nowrap">
                            {formatTimestamp(item.startTime)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                            {isSameInstant(item.startTime, item.endTime)
                              ? "—"
                              : formatTimestamp(item.endTime)}
                          </td>
                          <td className="px-3 py-2">{resolveDeviceLink(item.hostname)}</td>
                          <td className="px-3 py-2">{resolveInterfaceCell(item)}</td>
                          <td className="px-3 py-2">{anomalyMetricLabel(item.metric)}</td>
                          <td className="px-3 py-2 tabular-nums">{formatValueCell(item)}</td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                                item.detector === "ewma"
                                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                                  : "border-sky-500/40 bg-sky-500/10 text-sky-300",
                              )}
                            >
                              {anomalyDetectorLabel(item.detector)}
                              {item.sampleCount > 1 ? ` · ${item.sampleCount} samples` : ""}
                            </span>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {!loading && sortedItems.length > PAGE_SIZE ? (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
