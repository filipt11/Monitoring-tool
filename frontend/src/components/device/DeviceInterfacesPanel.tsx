import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownUp,
  Network,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { TimeSeriesChart } from "@/components/charts";
import { MetricsTimeRangeControl } from "@/components/charts/MetricsTimeRangeControl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TimeSeriesChartData } from "@/lib/charts.types";
import {
  fetchDeviceInterfaces,
  fetchInterfaceMetrics,
  findLatestPointWithField,
  toInterfaceMetricKey,
  type DeviceInterfaceInfo,
  type InterfaceMetricsApiResponse,
} from "@/lib/metricsApi";
import { createDefaultMetricsRange } from "@/lib/timeRangePresets";
import { bpsMetricLabels, scaleBpsChartData } from "@/lib/formatBps";
import { cn } from "@/lib/utils";

const INTERFACE_UTIL_METRICS = ["in_util_pct", "out_util_pct"] as const;
const INTERFACE_SPEED_METRICS = ["in_bps", "out_bps"] as const;
const INTERFACE_ALL_METRICS = [
  ...INTERFACE_UTIL_METRICS,
  ...INTERFACE_SPEED_METRICS,
] as const;
const HIGH_UTILIZATION_THRESHOLD = 90;
/** Inbound = cyan-blue, outbound = pink/magenta (cyberpunk-style pair). */
const INTERFACE_CHART_COLORS = ["#38bdf8", "#db2777"];

function formatChartTimestamp(date: Date): string {
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isInterfaceUp(iface: DeviceInterfaceInfo): boolean {
  return iface.adminStatus === "up" && iface.operStatus === "up";
}

function sortInterfacesForDisplay(
  items: DeviceInterfaceInfo[],
): DeviceInterfaceInfo[] {
  return [...items].sort((left, right) => {
    const leftUp = isInterfaceUp(left);
    const rightUp = isInterfaceUp(right);

    if (leftUp !== rightUp) {
      return leftUp ? -1 : 1;
    }

    return left.ifIndex - right.ifIndex;
  });
}

function buildUtilChartData(
  dataPoints: InterfaceMetricsApiResponse["dataPoints"],
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
          in_util_pct:
            inUtil != null ? Math.round(inUtil * 100) / 100 : null,
          out_util_pct:
            outUtil != null ? Math.round(outUtil * 100) / 100 : null,
        },
      ];
    })
    .sort((left, right) => left.timeMs - right.timeMs);
}

function buildSpeedChartData(
  dataPoints: InterfaceMetricsApiResponse["dataPoints"],
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

function interfaceDescription(iface: DeviceInterfaceInfo): string {
  return `Interface index ${iface.ifIndex} · Admin ${iface.adminStatus ?? "unknown"} · Oper ${iface.operStatus ?? "unknown"}`;
}

interface InterfaceChartState {
  utilData: TimeSeriesChartData[];
  speedData: TimeSeriesChartData[];
  loading: boolean;
  error: string | null;
  latestInUtil?: number;
  latestOutUtil?: number;
}

interface DeviceInterfacesPanelProps {
  deviceId: string;
}

export function DeviceInterfacesPanel({ deviceId }: DeviceInterfacesPanelProps) {
  const [interfaces, setInterfaces] = useState<DeviceInterfaceInfo[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [metricsRange, setMetricsRange] = useState(createDefaultMetricsRange);
  const [chartStates, setChartStates] = useState<Record<string, InterfaceChartState>>({});

  useEffect(() => {
    let active = true;

    async function loadCatalog() {
      setCatalogLoading(true);
      setCatalogError(null);

      try {
        const response = await fetchDeviceInterfaces(deviceId);
        if (active) {
          setInterfaces(response);
        }
      } catch (fetchError) {
        if (active) {
          setCatalogError(
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load interfaces.",
          );
          setInterfaces([]);
        }
      } finally {
        if (active) {
          setCatalogLoading(false);
        }
      }
    }

    void loadCatalog();

    return () => {
      active = false;
    };
  }, [deviceId]);

  useEffect(() => {
    if (interfaces.length === 0) {
      setChartStates({});
      return;
    }

    let active = true;
    const interfaceKeys = interfaces.map((iface) =>
      toInterfaceMetricKey(deviceId, iface.ifIndex),
    );

    setChartStates((prev) => {
      const next = { ...prev };
      interfaceKeys.forEach((key) => {
        next[key] = {
          utilData: prev[key]?.utilData ?? [],
          speedData: prev[key]?.speedData ?? [],
          loading: true,
          error: null,
          latestInUtil: prev[key]?.latestInUtil,
          latestOutUtil: prev[key]?.latestOutUtil,
        };
      });
      return next;
    });

    async function loadMetrics() {
      try {
        const response = await fetchInterfaceMetrics({
          interfaces: interfaceKeys,
          metrics: [...INTERFACE_ALL_METRICS],
          start: metricsRange.start,
          end: metricsRange.end,
        });

        if (!active) return;

        const responseByKey = new Map(
          response.map((entry) => [
            toInterfaceMetricKey(entry.deviceId, entry.ifIndex),
            entry,
          ]),
        );

        setChartStates((prev) => {
          const next = { ...prev };

          interfaceKeys.forEach((key) => {
            const metricsEntry = responseByKey.get(key);
            const points = metricsEntry?.dataPoints ?? [];
            const latestIn = findLatestPointWithField(points, "in_util_pct");
            const latestOut = findLatestPointWithField(points, "out_util_pct");

            next[key] = {
              utilData: buildUtilChartData(points),
              speedData: buildSpeedChartData(points),
              loading: false,
              error: null,
              latestInUtil: latestIn?.values?.in_util_pct,
              latestOutUtil: latestOut?.values?.out_util_pct,
            };
          });

          return next;
        });
      } catch (fetchError) {
        if (!active) return;

        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load interface metrics.";

        setChartStates((prev) => {
          const next = { ...prev };
          interfaceKeys.forEach((key) => {
            next[key] = {
              utilData: [],
              speedData: [],
              loading: false,
              error: message,
            };
          });
          return next;
        });
      }
    }

    void loadMetrics();

    return () => {
      active = false;
    };
  }, [deviceId, interfaces, metricsRange]);

  const handleMetricsRangeChange = useCallback((start: Date, end: Date) => {
    setMetricsRange({ start, end });
  }, []);

  const summary = useMemo(() => {
    const adminUp = interfaces.filter((iface) => iface.adminStatus === "up").length;
    const operUp = interfaces.filter((iface) => iface.operStatus === "up").length;

    let peakUtil = 0;
    interfaces.forEach((iface) => {
      const key = toInterfaceMetricKey(deviceId, iface.ifIndex);
      const state = chartStates[key];
      if (state?.latestInUtil != null) {
        peakUtil = Math.max(peakUtil, state.latestInUtil);
      }
      if (state?.latestOutUtil != null) {
        peakUtil = Math.max(peakUtil, state.latestOutUtil);
      }
    });

    return {
      total: interfaces.length,
      adminUp,
      operUp,
      peakUtil,
    };
  }, [chartStates, deviceId, interfaces]);

  const metricsLoading = interfaces.some((iface) => {
    const key = toInterfaceMetricKey(deviceId, iface.ifIndex);
    return chartStates[key]?.loading ?? true;
  });

  const sortedInterfaces = useMemo(
    () => sortInterfacesForDisplay(interfaces),
    [interfaces],
  );

  if (catalogLoading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Loading interfaces...
      </div>
    );
  }

  if (catalogError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {catalogError}
      </div>
    );
  }

  if (interfaces.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        No interfaces discovered for this device yet. Run rediscover from admin device
        management to populate the interface list.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Interfaces</CardTitle>
            <Network className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
            <p className="text-muted-foreground text-xs">Discovered on this device</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admin up</CardTitle>
            <ShieldCheck className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{summary.adminUp}</div>
            <p className="text-muted-foreground text-xs">
              {summary.total - summary.adminUp} administratively down
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Oper up</CardTitle>
            <Activity className="size-4 text-sky-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-400">{summary.operUp}</div>
            <p className="text-muted-foreground text-xs">
              {summary.total - summary.operUp} operationally down
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            summary.peakUtil > HIGH_UTILIZATION_THRESHOLD && "border-destructive/40",
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peak utilization</CardTitle>
            {summary.peakUtil > HIGH_UTILIZATION_THRESHOLD ? (
              <ShieldAlert className="size-4 text-destructive" />
            ) : (
              <ArrowDownUp className="text-muted-foreground size-4" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold",
                summary.peakUtil > HIGH_UTILIZATION_THRESHOLD && "text-destructive",
              )}
            >
              {summary.peakUtil > 0 ? `${Math.round(summary.peakUtil * 10) / 10}%` : "—"}
            </div>
            <p className="text-muted-foreground text-xs">
              Highest recent in/out util across interfaces
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Time range</CardTitle>
        </CardHeader>
        <CardContent>
          <MetricsTimeRangeControl
            idPrefix="interfaces-global"
            start={metricsRange.start}
            end={metricsRange.end}
            onApply={handleMetricsRangeChange}
            disabled={metricsLoading}
          />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">
            Interface utilization In/Out
          </h3>
          <p className="text-muted-foreground text-sm">
            Inbound and outbound utilization per interface for the selected time range.
          </p>
        </div>

        <div className="space-y-6">
        {sortedInterfaces.map((iface) => {
          const key = toInterfaceMetricKey(deviceId, iface.ifIndex);
          const state = chartStates[key] ?? {
            utilData: [],
            speedData: [],
            loading: true,
            error: null,
          };

          return (
            <TimeSeriesChart
              key={`util-${iface.id}`}
              data={state.utilData}
              metrics={[...INTERFACE_UTIL_METRICS]}
              metricLabels={{
                in_util_pct: "Inbound utilization (%)",
                out_util_pct: "Outbound utilization (%)",
              }}
              title={iface.name}
              description={interfaceDescription(iface)}
              initialStart={metricsRange.start}
              initialEnd={metricsRange.end}
              isLoading={state.loading}
              error={state.error}
              showMetricToggles={false}
              showTimeRangeControl={false}
              chartStyle="line"
              valueDecimals={2}
              colors={INTERFACE_CHART_COLORS}
            />
          );
        })}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">
            Interface Speed In/Out
          </h3>
          <p className="text-muted-foreground text-sm">
            Inbound and outbound throughput per interface for the selected time range.
          </p>
        </div>

        <div className="space-y-6">
        {sortedInterfaces.map((iface) => {
          const key = toInterfaceMetricKey(deviceId, iface.ifIndex);
          const state = chartStates[key] ?? {
            utilData: [],
            speedData: [],
            loading: true,
            error: null,
          };

          const speedMetrics = [...INTERFACE_SPEED_METRICS];
          const {
            data: scaledSpeedData,
            unit: speedUnit,
          } = scaleBpsChartData(state.speedData, speedMetrics);

          return (
            <TimeSeriesChart
              key={`speed-${iface.id}`}
              data={scaledSpeedData}
              metrics={speedMetrics}
              metricLabels={bpsMetricLabels(speedUnit)}
              title={iface.name}
              description={interfaceDescription(iface)}
              initialStart={metricsRange.start}
              initialEnd={metricsRange.end}
              isLoading={state.loading}
              error={state.error}
              showMetricToggles={false}
              showTimeRangeControl={false}
              chartStyle="line"
              valueDecimals={speedUnit === "bps" ? 0 : 2}
              colors={INTERFACE_CHART_COLORS}
            />
          );
        })}
        </div>
      </div>
    </div>
  );
}
