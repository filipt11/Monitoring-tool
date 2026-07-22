import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Gauge,
  Network,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { MetricsTimeRangeControl, TimeSeriesChart } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAppDate } from "@/lib/dateFormat";
import { formatBpsValue, bpsMetricLabels, scaleBpsChartData } from "@/lib/formatBps";
import { formatPercentValue } from "@/lib/formatPercent";
import {
  fetchInterfaceById,
  type InterfaceGroupMember,
} from "@/lib/interfaceGroupsApi";
import {
  buildInterfaceSpeedChartData,
  buildInterfaceUtilChartData,
  INTERFACE_CHART_COLORS,
  INTERFACE_SPEED_METRICS,
  INTERFACE_UTIL_METRICS,
} from "@/lib/interfaceMetricsCharts";
import {
  fetchInterfaceMetrics,
  toInterfaceMetricKey,
} from "@/lib/metricsApi";
import type { TimeSeriesChartData } from "@/lib/charts.types";
import { routes } from "@/lib/routes";
import { createDefaultMetricsRange, type DateRange } from "@/lib/timeRangePresets";
import { cn } from "@/lib/utils";

function formatInterfaceStatus(status: string | null | undefined) {
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function isStatusUp(status: string | null | undefined) {
  return status === "up";
}

export function InterfaceDetailsPage() {
  const { interfaceId } = useParams<{ interfaceId: string }>();
  const resolvedInterfaceId = interfaceId ?? "1";

  const [interfaceInfo, setInterfaceInfo] = useState<InterfaceGroupMember | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [metricsRange, setMetricsRange] = useState<DateRange>(createDefaultMetricsRange);
  const [utilData, setUtilData] = useState<TimeSeriesChartData[]>([]);
  const [speedData, setSpeedData] = useState<TimeSeriesChartData[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadInterface() {
      setCatalogLoading(true);
      setCatalogError(null);

      try {
        const info = await fetchInterfaceById(Number(resolvedInterfaceId));
        if (active) {
          setInterfaceInfo(info);
        }
      } catch (fetchError) {
        if (active) {
          setCatalogError(
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load interface details.",
          );
          setInterfaceInfo(null);
        }
      } finally {
        if (active) {
          setCatalogLoading(false);
        }
      }
    }

    void loadInterface();

    return () => {
      active = false;
    };
  }, [resolvedInterfaceId]);

  useEffect(() => {
    if (!interfaceInfo) {
      setUtilData([]);
      setSpeedData([]);
      setMetricsLoading(false);
      return;
    }

    let active = true;
    const metricKey = toInterfaceMetricKey(interfaceInfo.deviceId, interfaceInfo.ifIndex);

    async function loadMetrics() {
      setMetricsLoading(true);
      setMetricsError(null);

      try {
        const response = await fetchInterfaceMetrics({
          interfaces: [metricKey],
          metrics: [...INTERFACE_UTIL_METRICS, ...INTERFACE_SPEED_METRICS],
          start: metricsRange.start,
          end: metricsRange.end,
        });

        if (!active) return;

        const points = response[0]?.dataPoints ?? [];
        setUtilData(buildInterfaceUtilChartData(points));
        setSpeedData(buildInterfaceSpeedChartData(points));
      } catch (fetchError) {
        if (active) {
          setUtilData([]);
          setSpeedData([]);
          setMetricsError(
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load interface metrics.",
          );
        }
      } finally {
        if (active) {
          setMetricsLoading(false);
        }
      }
    }

    void loadMetrics();

    return () => {
      active = false;
    };
  }, [interfaceInfo, metricsRange]);

  const handleMetricsRangeChange = useCallback(
    (start: Date, end: Date, meta?: { refreshToken?: number }) => {
      setMetricsRange({ start, end, refreshToken: meta?.refreshToken });
    },
    [],
  );

  const speedChart = useMemo(() => {
    const speedMetrics = [...INTERFACE_SPEED_METRICS];
    return scaleBpsChartData(speedData, speedMetrics);
  }, [speedData]);

  const interfaceTitle = interfaceInfo?.name ?? `Interface ${resolvedInterfaceId}`;
  const adminUp = isStatusUp(interfaceInfo?.adminStatus);
  const operUp = isStatusUp(interfaceInfo?.operStatus);
  const speedLabel =
    interfaceInfo?.speedBps != null
      ? formatBpsValue(interfaceInfo.speedBps).text
      : "—";

  const pageDescription = useMemo(() => {
    if (!interfaceInfo) {
      return "Interface utilization and throughput metrics.";
    }

    const parts = [
      interfaceInfo.deviceIp,
      `Index ${interfaceInfo.ifIndex}`,
    ];

    if (interfaceInfo.discoveredAt) {
      parts.push(
        `Discovered ${formatAppDate(new Date(interfaceInfo.discoveredAt), {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}`,
      );
    }

    parts.push("Inbound and outbound utilization for the selected time range.");

    return parts.join(" · ");
  }, [interfaceInfo]);

  if (catalogLoading) {
    return (
      <div className="text-muted-foreground flex min-h-40 items-center justify-center text-sm">
        Loading interface details...
      </div>
    );
  }

  if (catalogError || !interfaceInfo) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" asChild>
          <Link to={routes.interfaces}>
            <ArrowLeft className="size-4" />
            Back to interfaces
          </Link>
        </Button>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {catalogError ?? "Interface not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link to={routes.interfaces}>
            <ArrowLeft className="size-4" />
            Back to interfaces
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Network className="size-5" />
          {interfaceTitle}
        </h2>
        <p className="text-muted-foreground text-sm">{pageDescription}</p>
        <p className="text-muted-foreground text-sm">
          Device:{" "}
          <Button variant="link" className="h-auto p-0 text-sm" asChild>
            <Link to={routes.deviceDetails(String(interfaceInfo.deviceId))}>
              {interfaceInfo.deviceHostname}
            </Link>
          </Button>
          {interfaceInfo.mac ? ` · MAC ${interfaceInfo.mac}` : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className={cn(!adminUp && "border-destructive/40")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admin status</CardTitle>
            {adminUp ? (
              <ShieldCheck className="size-4 text-emerald-500" />
            ) : (
              <ShieldAlert className="size-4 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold",
                adminUp ? "text-emerald-500" : "text-destructive",
              )}
            >
              {formatInterfaceStatus(interfaceInfo.adminStatus)}
            </div>
            <p className="text-muted-foreground text-xs">Configured state</p>
          </CardContent>
        </Card>

        <Card className={cn(!operUp && "border-destructive/40")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Oper status</CardTitle>
            {operUp ? (
              <Activity className="size-4 text-sky-400" />
            ) : (
              <ShieldAlert className="size-4 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold",
                operUp ? "text-sky-400" : "text-destructive",
              )}
            >
              {formatInterfaceStatus(interfaceInfo.operStatus)}
            </div>
            <p className="text-muted-foreground text-xs">Current link state</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Link speed</CardTitle>
            <Gauge className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{speedLabel}</div>
            <p className="text-muted-foreground text-xs">Reported interface speed</p>
          </CardContent>
        </Card>
      </div>

      <MetricsTimeRangeControl
        idPrefix="interface-metrics"
        start={metricsRange.start}
        end={metricsRange.end}
        onApply={handleMetricsRangeChange}
        disabled={metricsLoading}
        isRefreshing={metricsLoading}
      />

      <TimeSeriesChart
        chartInstanceId={`interface-${resolvedInterfaceId}-util`}
        data={utilData}
        metrics={[...INTERFACE_UTIL_METRICS]}
        metricLabels={{
          in_util_pct: "Inbound utilization (%)",
          out_util_pct: "Outbound utilization (%)",
        }}
        title="Interface utilization In/Out"
        description="Inbound and outbound utilization for the selected time range."
        initialStart={metricsRange.start}
        initialEnd={metricsRange.end}
        isLoading={metricsLoading}
        error={metricsError}
        showMetricToggles={false}
        showTimeRangeControl={false}
        chartStyle="line"
        valueDecimals={2}
        formatValue={formatPercentValue}
        colors={INTERFACE_CHART_COLORS}
      />

      <TimeSeriesChart
        chartInstanceId={`interface-${resolvedInterfaceId}-speed`}
        data={speedChart.data}
        metrics={[...INTERFACE_SPEED_METRICS]}
        metricLabels={bpsMetricLabels(speedChart.unit)}
        title="Interface speed In/Out"
        description="Inbound and outbound throughput for the selected time range."
        initialStart={metricsRange.start}
        initialEnd={metricsRange.end}
        isLoading={metricsLoading}
        error={metricsError}
        showMetricToggles={false}
        showTimeRangeControl={false}
        chartStyle="line"
        valueDecimals={speedChart.unit === "bps" ? 0 : 2}
        colors={INTERFACE_CHART_COLORS}
      />
    </div>
  );
}
