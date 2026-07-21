import { useCallback, useEffect, useMemo, useState } from "react";

import { GaugeChart, MetricsTable, TimeSeriesChart } from "@/components/charts";
import {
  buildDeviceChartPanels,
  buildDeviceGaugeData,
  buildDeviceTableData,
  buildInterfaceChartPanels,
  buildInterfaceGaugeData,
  buildInterfaceTableData,
  hasResolvedSources,
  shouldPanelUseAreaFill,
  type DashboardChartPanel,
} from "@/lib/dashboardChartData";
import {
  isTimeseriesGraphType,
  resolveTimeseriesLayout,
} from "@/lib/dashboardConfig";
import type { DashboardSectionDetail } from "@/lib/dashboardsApi";
import {
  getDisplayMetricLabels,
  getMetricMaxValues,
  scaleDashboardChartPanel,
  scaleMetricForDisplay,
} from "@/lib/dashboardMetricFormat";
import {
  fetchDeviceMetrics,
  fetchInterfaceMetrics,
  type DeviceMetricsApiResponse,
  type InterfaceMetricsApiResponse,
} from "@/lib/metricsApi";
import { resolveSectionSources } from "@/lib/resolveSectionSources";
import type { DateRange } from "@/lib/timeRangePresets";
import type { GaugeChartData, TableRowData } from "@/lib/charts.types";

interface DashboardSectionWidgetProps {
  dashboardId: number;
  section: DashboardSectionDetail;
  range: DateRange;
}

export function DashboardSectionWidget({
  dashboardId,
  section,
  range,
}: DashboardSectionWidgetProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartPanels, setChartPanels] = useState<DashboardChartPanel[]>([]);
  const [gaugeData, setGaugeData] = useState<GaugeChartData[]>([]);
  const [tableData, setTableData] = useState<TableRowData[]>([]);

  const displayPanels = useMemo(
    () => chartPanels.map((panel) => scaleDashboardChartPanel(panel)),
    [chartPanels],
  );

  const tableMetricLabels = useMemo(
    () => getDisplayMetricLabels(section.metrics, getMetricMaxValues(tableData, section.metrics)),
    [section.metrics, tableData],
  );

  const displayTableData = useMemo(
    () =>
      tableData.map((row) => {
        const formattedRow = { ...row };

        for (const metric of section.metrics) {
          const value = row[metric];
          if (typeof value === "number") {
            formattedRow[metric] = scaleMetricForDisplay(metric, value).text;
          }
        }

        return formattedRow;
      }),
    [section.metrics, tableData],
  );

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const sources = await resolveSectionSources(section);

      if (!hasResolvedSources(sources)) {
        setChartPanels([]);
        setGaugeData([]);
        setTableData([]);
        setError("No data sources configured for this section.");
        return;
      }

      const layout = resolveTimeseriesLayout(
        section.graphType,
        sources.scope === "device" ? sources.deviceIds.length : sources.interfaces.length,
      );

      if (sources.scope === "device") {
        const response: DeviceMetricsApiResponse[] = await fetchDeviceMetrics({
          deviceIds: sources.deviceIds,
          metrics: section.metrics,
          start: range.start,
          end: range.end,
        });

        setChartPanels(
          buildDeviceChartPanels(response, section.metrics, sources.deviceLabels, layout),
        );
        setGaugeData(buildDeviceGaugeData(response, section.metrics, sources.deviceLabels));
        setTableData(buildDeviceTableData(response, section.metrics, sources.deviceLabels));
        return;
      }

      const interfaceKeys = sources.interfaces.map((entry) => entry.metricKey);
      const response: InterfaceMetricsApiResponse[] = await fetchInterfaceMetrics({
        interfaces: interfaceKeys,
        metrics: section.metrics,
        start: range.start,
        end: range.end,
      });

      setChartPanels(
        buildInterfaceChartPanels(response, section.metrics, sources.interfaces, layout),
      );
      setGaugeData(buildInterfaceGaugeData(response, section.metrics, sources.interfaces));
      setTableData(buildInterfaceTableData(response, section.metrics, sources.interfaces));
    } catch (fetchError) {
      setChartPanels([]);
      setGaugeData([]);
      setTableData([]);
      setError(
        fetchError instanceof Error ? fetchError.message : "Failed to load section metrics.",
      );
    } finally {
      setLoading(false);
    }
  }, [range.end, range.start, section]);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics, dashboardId]);

  if (section.graphType === "gauge") {
    return (
      <GaugeChart
        data={gaugeData}
        title={section.name}
        description={`Gauge view · ${section.metrics.length} metric(s)`}
        isLoading={loading}
        error={error}
        hideControls
      />
    );
  }

  if (section.graphType === "table") {
    return (
      <MetricsTable
        data={displayTableData}
        metrics={section.metrics}
        title={section.name}
        description="Latest values for selected sources"
        isLoading={loading}
        error={error}
        hideControls
        metricLabels={tableMetricLabels}
      />
    );
  }

  if (!isTimeseriesGraphType(section.graphType)) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
        Unsupported chart type: {section.graphType}
      </div>
    );
  }

  if (loading && displayPanels.length === 0) {
    return (
      <div className="text-muted-foreground flex min-h-40 items-center justify-center text-sm">
        Loading chart data...
      </div>
    );
  }

  if (error && displayPanels.length === 0) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">{section.name}</h3>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {displayPanels.length === 0 ? (
        <div className="text-muted-foreground flex min-h-40 items-center justify-center rounded-lg border border-dashed text-sm">
          No data available for the selected time range and metrics.
        </div>
      ) : (
        displayPanels.map((panel) => (
          <TimeSeriesChart
            key={panel.id}
            chartInstanceId={panel.id}
            data={panel.data}
            metrics={panel.seriesKeys}
            metricLabels={panel.metricLabels}
            title={panel.title}
            initialStart={range.start}
            initialEnd={range.end}
            isLoading={loading}
            error={error}
            valueDecimals={panel.valueDecimals}
            chartStyle={shouldPanelUseAreaFill(panel) ? "area" : "line"}
            showMetricToggles={false}
            showTimeRangeControl={false}
          />
        ))
      )}
    </div>
  );
}
