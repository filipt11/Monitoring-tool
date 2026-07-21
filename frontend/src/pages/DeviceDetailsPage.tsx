import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Cpu, MemoryStick, Network, Server, ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimeSeriesChart, HeatmapChart } from "@/components/charts";
import { DeviceInterfacesPanel } from "@/components/device/DeviceInterfacesPanel";
import {
  DEVICE_STATUS_UP,
  DEVICE_STATUS_DOWN,
  fetchDeviceAvailability,
  fetchDeviceInfo,
  fetchDeviceMetrics,
  findLatestPointWithField,
  type DeviceInfo,
} from "@/lib/metricsApi";
import {
  bucketTimestampToAvailabilityCell,
  type AvailabilityCell,
  type TimeSeriesChartData,
} from "@/lib/charts.types";
import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";
import { createDefaultMetricsRange } from "@/lib/timeRangePresets";

const HEATMAP_RANGE_MS = 14 * 24 * 60 * 60 * 1000;
const HIGH_UTILIZATION_THRESHOLD = 90;

function isHighUtilization(value: number | null | undefined) {
  return value != null && value > HIGH_UTILIZATION_THRESHOLD;
}

interface LatestSnapshot {
  status?: number;
  statusTimestamp?: string;
  cpuUsage?: number;
  memoryUsagePct?: number;
}

function formatChartTimestamp(date: Date): string {
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getHeatmapRange() {
  const end = new Date();
  return {
    start: new Date(end.getTime() - HEATMAP_RANGE_MS),
    end,
  };
}

function createDefaultRange() {
  return createDefaultMetricsRange();
}

type DeviceDetailsView = "device" | "interfaces";

export function DeviceDetailsPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const resolvedDeviceId = deviceId ?? "1";

  const [activeView, setActiveView] = useState<DeviceDetailsView>("device");
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);

  const [cpuRange, setCpuRange] = useState(createDefaultRange);
  const [memoryRange, setMemoryRange] = useState(createDefaultRange);

  const [cpuChartData, setCpuChartData] = useState<TimeSeriesChartData[]>([]);
  const [cpuLoading, setCpuLoading] = useState(true);
  const [cpuError, setCpuError] = useState<string | null>(null);

  const [memoryChartData, setMemoryChartData] = useState<TimeSeriesChartData[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(true);
  const [memoryError, setMemoryError] = useState<string | null>(null);

  const [latestSnapshot, setLatestSnapshot] = useState<LatestSnapshot | null>(null);

  const [availabilityData, setAvailabilityData] = useState<AvailabilityCell[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  const heatmapRange = useMemo(() => getHeatmapRange(), []);

  const deviceTitle = useMemo(
    () => deviceInfo?.hostname ?? `Device ${resolvedDeviceId}`,
    [deviceInfo, resolvedDeviceId],
  );

  useEffect(() => {
    let active = true;

    fetchDeviceInfo(resolvedDeviceId)
      .then((info) => {
        if (active) setDeviceInfo(info);
      })
      .catch(() => {
        // Non-critical: the page still works with just the numeric device id.
      });

    return () => {
      active = false;
    };
  }, [resolvedDeviceId]);

  useEffect(() => {
    let active = true;

    async function loadCpuMetrics() {
      setCpuLoading(true);
      setCpuError(null);

      try {
        const response = await fetchDeviceMetrics({
          deviceIds: [resolvedDeviceId],
          metrics: ["cpu_usage", "status"],
          start: cpuRange.start,
          end: cpuRange.end,
        });

        if (!active) return;

        const deviceMetrics =
          response.find((entry) => entry.deviceId === resolvedDeviceId) ?? response[0];
        const points = deviceMetrics?.dataPoints ?? [];

        const chartRows: TimeSeriesChartData[] = points.flatMap((point) => {
          if (point.values?.cpu_usage == null) {
            return [];
          }

          const timestamp = new Date(point.timestamp);
          return [
            {
              timeMs: timestamp.getTime(),
              timestamp: formatChartTimestamp(timestamp),
              cpu_usage: point.values.cpu_usage,
            },
          ];
        });

        setCpuChartData(chartRows);

        const latestStatus = findLatestPointWithField(points, "status");
        const latestCpu = findLatestPointWithField(points, "cpu_usage");

        setLatestSnapshot((prev) => ({
          status: latestStatus?.values?.status ?? prev?.status,
          statusTimestamp: latestStatus?.timestamp ?? prev?.statusTimestamp,
          cpuUsage: latestCpu?.values?.cpu_usage ?? prev?.cpuUsage,
          memoryUsagePct: prev?.memoryUsagePct,
        }));
      } catch (fetchError) {
        if (active) {
          setCpuError(
            fetchError instanceof Error ? fetchError.message : "Failed to load CPU metrics.",
          );
          setCpuChartData([]);
        }
      } finally {
        if (active) setCpuLoading(false);
      }
    }

    void loadCpuMetrics();

    return () => {
      active = false;
    };
  }, [resolvedDeviceId, cpuRange]);

  useEffect(() => {
    let active = true;

    async function loadMemoryMetrics() {
      setMemoryLoading(true);
      setMemoryError(null);

      try {
        const response = await fetchDeviceMetrics({
          deviceIds: [resolvedDeviceId],
          metrics: ["memory_usage_pct"],
          start: memoryRange.start,
          end: memoryRange.end,
        });

        if (!active) return;

        const deviceMetrics =
          response.find((entry) => entry.deviceId === resolvedDeviceId) ?? response[0];
        const points = deviceMetrics?.dataPoints ?? [];

        const chartRows: TimeSeriesChartData[] = points.flatMap((point) => {
          if (point.values?.memory_usage_pct == null) {
            return [];
          }

          const timestamp = new Date(point.timestamp);
          return [
            {
              timeMs: timestamp.getTime(),
              timestamp: formatChartTimestamp(timestamp),
              memory_usage_pct: Math.round(point.values.memory_usage_pct * 100) / 100,
            },
          ];
        });

        setMemoryChartData(chartRows);

        const latestMemory = findLatestPointWithField(points, "memory_usage_pct");

        setLatestSnapshot((prev) =>
          latestMemory
            ? {
                ...prev,
                memoryUsagePct:
                  latestMemory.values?.memory_usage_pct ?? prev?.memoryUsagePct,
              }
            : prev,
        );
      } catch (fetchError) {
        if (active) {
          setMemoryError(
            fetchError instanceof Error ? fetchError.message : "Failed to load memory metrics.",
          );
          setMemoryChartData([]);
        }
      } finally {
        if (active) setMemoryLoading(false);
      }
    }

    void loadMemoryMetrics();

    return () => {
      active = false;
    };
  }, [resolvedDeviceId, memoryRange]);

  useEffect(() => {
    let active = true;

    async function loadAvailability() {
      setAvailabilityLoading(true);
      setAvailabilityError(null);

      const { start, end } = getHeatmapRange();

      try {
        const response = await fetchDeviceAvailability({
          deviceIds: [resolvedDeviceId],
          start,
          end,
        });

        if (!active) return;

        const deviceAvailability =
          response.find((entry) => entry.deviceId === resolvedDeviceId) ?? response[0];
        const buckets = deviceAvailability?.buckets ?? [];

        const cells: AvailabilityCell[] = buckets.map((bucket) =>
          bucketTimestampToAvailabilityCell(bucket.timestamp, bucket.status),
        );

        setAvailabilityData(cells);

        if (cells.length === 0) {
          setAvailabilityError(
            "No availability data found for this device in the selected time range.",
          );
        }
      } catch (fetchError) {
        if (active) {
          setAvailabilityError(
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load availability data.",
          );
          setAvailabilityData([]);
        }
      } finally {
        if (active) setAvailabilityLoading(false);
      }
    }

    void loadAvailability();

    return () => {
      active = false;
    };
  }, [resolvedDeviceId]);

  const handleCpuRangeChange = useCallback((start: Date, end: Date) => {
    setCpuRange({ start, end });
  }, []);

  const handleMemoryRangeChange = useCallback((start: Date, end: Date) => {
    setMemoryRange({ start, end });
  }, []);

  const isOnline = latestSnapshot?.status === DEVICE_STATUS_UP;
  const isOffline = latestSnapshot?.status === DEVICE_STATUS_DOWN;
  const cpuUsage = latestSnapshot?.cpuUsage ?? null;
  const memoryUsagePct = latestSnapshot?.memoryUsagePct ?? null;
  const isCpuCritical = isHighUtilization(cpuUsage);
  const isMemoryCritical = isHighUtilization(memoryUsagePct);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link to={routes.devices}>
            <ArrowLeft className="size-4" />
            Back to devices
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            {activeView === "device" ? (
              <Server className="size-5" />
            ) : (
              <Network className="size-5" />
            )}
            {deviceTitle} Monitoring
          </h2>
          <p className="text-muted-foreground text-sm">
            {deviceInfo?.ip ? `${deviceInfo.ip} · ` : ""}
            {activeView === "device"
              ? "Live CPU, memory, and availability data pulled from the monitoring backend."
              : "Discovered interfaces and utilization metrics for this device."}
          </p>
        </div>

        <div className="bg-muted/40 flex shrink-0 self-start rounded-full border border-border/60 p-1.5 lg:mt-1">
          <Button
            type="button"
            variant={activeView === "device" ? "default" : "ghost"}
            className="h-10 rounded-full px-6 text-sm"
            onClick={() => setActiveView("device")}
          >
            <Server className="size-4" />
            Device
          </Button>
          <Button
            type="button"
            variant={activeView === "interfaces" ? "default" : "ghost"}
            className="h-10 rounded-full px-6 text-sm"
            onClick={() => setActiveView("interfaces")}
          >
            <Network className="size-4" />
            Interfaces
          </Button>
        </div>
      </div>

      {activeView === "interfaces" ? (
        <DeviceInterfacesPanel deviceId={resolvedDeviceId} />
      ) : (
        <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            {isOnline ? (
              <ShieldCheck className="size-4 text-emerald-500" />
            ) : isOffline ? (
              <ShieldAlert className="size-4 text-destructive" />
            ) : (
              <ShieldAlert className="text-muted-foreground size-4" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                isOnline
                  ? "text-emerald-500"
                  : isOffline
                    ? "text-destructive"
                    : "text-muted-foreground"
              }`}
            >
              {latestSnapshot?.status == null
                ? "Unknown"
                : isOnline
                  ? "Online"
                  : "Offline"}
            </div>
            <p className="text-muted-foreground text-xs">
              {latestSnapshot?.statusTimestamp
                ? `Last seen ${new Date(latestSnapshot.statusTimestamp).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : "No recent data"}
            </p>
          </CardContent>
        </Card>

        <Card className={cn(isCpuCritical && "border-destructive/40")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU usage</CardTitle>
            {isCpuCritical ? (
              <TriangleAlert className="size-4 text-destructive" />
            ) : (
              <Cpu className="text-muted-foreground size-4" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold",
                isCpuCritical && "text-destructive",
              )}
            >
              {cpuUsage != null ? `${cpuUsage}%` : "—"}
            </div>
            <p className="text-muted-foreground text-xs">
              {isCpuCritical ? "High utilization" : "Most recent sample"}
            </p>
          </CardContent>
        </Card>

        <Card className={cn(isMemoryCritical && "border-destructive/40")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory usage</CardTitle>
            {isMemoryCritical ? (
              <TriangleAlert className="size-4 text-destructive" />
            ) : (
              <MemoryStick className="text-muted-foreground size-4" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold",
                isMemoryCritical && "text-destructive",
              )}
            >
              {memoryUsagePct != null
                ? `${Math.round(memoryUsagePct * 10) / 10}%`
                : "—"}
            </div>
            <p className="text-muted-foreground text-xs">
              {isMemoryCritical ? "High utilization" : "Most recent sample"}
            </p>
          </CardContent>
        </Card>
      </div>

      <TimeSeriesChart
        chartInstanceId={`device-${resolvedDeviceId}-cpu`}
        data={cpuChartData}
        metrics={["cpu_usage"]}
        metricLabels={{ cpu_usage: "CPU Usage (%)" }}
        title="CPU Usage"
        description="CPU utilization over the selected time range."
        initialStart={cpuRange.start}
        initialEnd={cpuRange.end}
        onDateRangeChange={handleCpuRangeChange}
        isLoading={cpuLoading}
        error={cpuError}
        showMetricToggles={false}
        chartStyle="area"
      />

      <TimeSeriesChart
        chartInstanceId={`device-${resolvedDeviceId}-memory`}
        data={memoryChartData}
        metrics={["memory_usage_pct"]}
        metricLabels={{ memory_usage_pct: "Memory Usage (%)" }}
        title="Memory Usage"
        description="Memory utilization over the selected time range."
        initialStart={memoryRange.start}
        initialEnd={memoryRange.end}
        onDateRangeChange={handleMemoryRangeChange}
        isLoading={memoryLoading}
        error={memoryError}
        showMetricToggles={false}
        chartStyle="area"
        valueDecimals={2}
      />

      <HeatmapChart
        data={availabilityData}
        rangeStart={heatmapRange.start}
        rangeEnd={heatmapRange.end}
        title="Device Availability Heatmap"
        description="Last 14 days of hourly availability (aggregated on the server). An hour is marked down if the device was unreachable at any point during that hour."
        isLoading={availabilityLoading}
        error={availabilityError}
      />
        </>
      )}
    </div>
  );
}
