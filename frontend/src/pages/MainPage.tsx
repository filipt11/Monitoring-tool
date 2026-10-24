import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Server, XCircle } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createDefaultAnomaliesRange,
  fetchAnomalies,
} from "@/lib/anomaliesApi";
import { fetchDeviceList, type DeviceRecord } from "@/lib/devicesApi";
import {
  DEVICE_STATUS_UP,
  extractLatestMetrics,
  fetchDeviceMetrics,
  statusLabel,
} from "@/lib/metricsApi";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

interface TopDeviceRow extends DeviceRecord {
  status?: number;
  cpuUsage?: number;
  memoryUsagePct?: number;
}

const TOP_DEVICE_COUNT = 10;
const METRICS_LOOKBACK_MS = 15 * 60 * 1000;

function formatMemoryPct(value?: number): string {
  if (value == null) return "—";
  return `${(Math.round(value * 100) / 100).toFixed(2)}%`;
}

function formatCpu(value?: number): string {
  if (value == null) return "—";
  return `${Math.round(value)}%`;
}

export function MainPage() {
  const [activeDeviceCount, setActiveDeviceCount] = useState<number | null>(null);
  const [anomalyCount, setAnomalyCount] = useState<number | null>(null);
  const [topDevices, setTopDevices] = useState<TopDeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAnomalyCount() {
      try {
        const { start, end } = createDefaultAnomaliesRange();
        const response = await fetchAnomalies({ start, end });
        if (active) {
          setAnomalyCount(response.items.length);
        }
      } catch {
        if (active) {
          setAnomalyCount(null);
        }
      }
    }

    async function loadTopDevices() {
      setLoading(true);
      setError(null);

      try {
        const { devices, totalElements } = await fetchDeviceList();
        if (!active) return;

        setActiveDeviceCount(totalElements);

        if (devices.length === 0) {
          setTopDevices([]);
          return;
        }

        const end = new Date();
        const start = new Date(end.getTime() - METRICS_LOOKBACK_MS);
        const metricsResponse = await fetchDeviceMetrics({
          deviceIds: devices.map((device) => String(device.id)),
          metrics: ["cpu_usage", "memory_usage_pct", "status"],
          start,
          end,
        });

        if (!active) return;

        const metricsByDevice = extractLatestMetrics(metricsResponse);

        const rankedDevices: TopDeviceRow[] = devices
          .map((device) => {
            const metrics = metricsByDevice.get(String(device.id));
            return {
              ...device,
              status: metrics?.status,
              cpuUsage: metrics?.cpuUsage,
              memoryUsagePct: metrics?.memoryUsagePct,
            };
          })
          .sort((left, right) => (right.cpuUsage ?? -1) - (left.cpuUsage ?? -1))
          .slice(0, TOP_DEVICE_COUNT);

        setTopDevices(rankedDevices);
      } catch (fetchError) {
        if (active) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load top utilized devices.",
          );
          setTopDevices([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadTopDevices();
    void loadAnomalyCount();

    return () => {
      active = false;
    };
  }, []);

  const hasCpuData = useMemo(
    () => topDevices.some((device) => device.cpuUsage != null),
    [topDevices],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active devices</CardTitle>
            <Server className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeDeviceCount == null ? "—" : activeDeviceCount}
            </div>
            <p className="text-muted-foreground text-xs">Registered in the monitoring system</p>
          </CardContent>
        </Card>

        <Link to={routes.anomalies} className="block transition-opacity hover:opacity-90">
          <Card
            className={cn(
              "h-full",
              anomalyCount != null &&
                anomalyCount > 0 &&
                "border-amber-500/30 bg-amber-500/5",
            )}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Anomalies (3h)</CardTitle>
              <AlertTriangle
                className={cn(
                  "size-4",
                  anomalyCount != null && anomalyCount > 0
                    ? "text-amber-500"
                    : "text-muted-foreground",
                )}
              />
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  "text-2xl font-bold",
                  anomalyCount != null && anomalyCount > 0 && "text-amber-400",
                )}
              >
                {anomalyCount == null ? "—" : anomalyCount}
              </div>
              <p className="text-muted-foreground text-xs">
                Detected in the last 3 hours
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="size-5" />
            Top {TOP_DEVICE_COUNT} utilized devices
          </CardTitle>
          <CardDescription>
            Ranked by the most recent CPU usage sample from the last 15 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground flex min-h-64 items-center justify-center rounded-lg border border-dashed text-sm">
              Loading top utilized devices...
            </div>
          ) : error ? (
            <div className="flex min-h-64 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
              {error}
            </div>
          ) : topDevices.length === 0 ? (
            <div className="text-muted-foreground flex min-h-64 items-center justify-center rounded-lg border border-dashed text-sm">
              No devices available to rank.
            </div>
          ) : (
            <div className="space-y-4">
              {!hasCpuData && (
                <p className="text-muted-foreground text-xs">
                  No recent CPU metrics found. Devices are listed without utilization data.
                </p>
              )}

              <div className="overflow-hidden rounded-lg border">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">#</th>
                      <th className="px-4 py-3 text-left font-medium">Name</th>
                      <th className="px-4 py-3 text-left font-medium">Address</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">CPU usage</th>
                      <th className="px-4 py-3 text-left font-medium">Memory usage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-background/80">
                    {topDevices.map((device, index) => {
                      const isOnline = device.status === DEVICE_STATUS_UP;
                      const isOffline = device.status === 0;

                      return (
                        <tr key={device.id} className="hover:bg-muted/40">
                          <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                          <td className="px-4 py-3">
                            <Button variant="link" className="h-auto p-0 text-sm" asChild>
                              <Link to={routes.deviceDetails(String(device.id))}>
                                {device.hostname}
                              </Link>
                            </Button>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{device.ipAddress}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                                isOnline
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                  : isOffline
                                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                                    : "border-border bg-muted/30 text-muted-foreground"
                              }`}
                            >
                              {isOnline ? (
                                <CheckCircle2 className="size-3.5" />
                              ) : isOffline ? (
                                <XCircle className="size-3.5" />
                              ) : null}
                              {statusLabel(device.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono">{formatCpu(device.cpuUsage)}</td>
                          <td className="px-4 py-3 font-mono">
                            {formatMemoryPct(device.memoryUsagePct)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
