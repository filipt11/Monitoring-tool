import type { Dashboard, DashboardSectionDetail } from "@/lib/dashboardsApi";
import { sortDashboardSections } from "@/lib/dashboardsApi";
import { getMetricDefinition, isSummaryGraphType, isTimeseriesGraphType } from "@/lib/dashboardConfig";
import {
  buildDeviceTableDataFromSummary,
  buildInterfaceTableDataFromSummary,
  hasResolvedSources,
} from "@/lib/dashboardChartData";
import { getDisplayMetricLabel } from "@/lib/dashboardMetricFormat";
import { formatAppChartDateTime } from "@/lib/dateFormat";
import { sanitizePdfFilename } from "@/lib/exportDashboardPdf";
import { getBytesDisplayScale } from "@/lib/formatBytes";
import { getBpsDisplayScale } from "@/lib/formatBps";
import { formatPercentValue } from "@/lib/formatPercent";
import { toAvailabilityPercentScale } from "@/lib/formatAvailability";
import {
  fetchDeviceMetrics,
  fetchDeviceMetricsSummary,
  fetchInterfaceMetrics,
  fetchInterfaceMetricsSummary,
} from "@/lib/metricsApi";
import { resolveSectionSources } from "@/lib/resolveSectionSources";
import type { DateRange } from "@/lib/timeRangePresets";
import type { TableRowData } from "@/lib/charts.types";

type CsvCell = string | number | null | undefined;

interface MetricFormatContext {
  maxValues: Record<string, number>;
  byteDivisors: Record<string, { divisor: number; unit: string }>;
  bpsDivisors: Record<string, { divisor: number; unit: string }>;
}

function escapeCsvCell(value: CsvCell): string {
  if (value == null) {
    return "";
  }

  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function rowToCsv(cells: CsvCell[]): string {
  return cells.map(escapeCsvCell).join(",");
}

function roundToTwoDecimals(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function computeMaxValues(
  metrics: string[],
  valueSets: Array<Record<string, number | undefined>>,
): Record<string, number> {
  return Object.fromEntries(
    metrics.map((metric) => [
      metric,
      valueSets.reduce((max, row) => {
        const value = row[metric];
        return typeof value === "number" && Number.isFinite(value) ? Math.max(max, value) : max;
      }, 0),
    ]),
  );
}

function buildMetricFormatContext(
  metrics: string[],
  valueSets: Array<Record<string, number | undefined>>,
): MetricFormatContext {
  const maxValues = computeMaxValues(metrics, valueSets);
  const byteDivisors: Record<string, { divisor: number; unit: string }> = {};
  const bpsDivisors: Record<string, { divisor: number; unit: string }> = {};

  for (const metric of metrics) {
    const definition = getMetricDefinition(metric);
    const maxValue = maxValues[metric] ?? 0;

    if (definition?.scaleType === "bytes") {
      const { divisor, unit } = getBytesDisplayScale(maxValue);
      byteDivisors[metric] = { divisor, unit };
    }

    if (definition?.scaleType === "bps") {
      const { divisor, unit } = getBpsDisplayScale(maxValue);
      bpsDivisors[metric] = { divisor, unit };
    }
  }

  return { maxValues, byteDivisors, bpsDivisors };
}

function getMetricColumnLabels(metrics: string[], maxValues: Record<string, number>): string[] {
  return metrics.map((metric) => getDisplayMetricLabel(metric, maxValues[metric]));
}

function formatCsvMetricValue(
  metric: string,
  value: number | undefined,
  context: MetricFormatContext,
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "";
  }

  const definition = getMetricDefinition(metric);

  if (definition?.scaleType === "bytes") {
    const scale = context.byteDivisors[metric] ?? getBytesDisplayScale(value);
    return roundToTwoDecimals(value / scale.divisor);
  }

  if (definition?.scaleType === "bps") {
    const scale = context.bpsDivisors[metric] ?? getBpsDisplayScale(value);
    return roundToTwoDecimals(value / scale.divisor);
  }

  if (definition?.isAvailability) {
    return roundToTwoDecimals(toAvailabilityPercentScale(value));
  }

  if (definition?.isPercentage) {
    return formatPercentValue(value, { decimals: 2 });
  }

  return roundToTwoDecimals(value);
}

function tableRowValues(row: TableRowData, metrics: string[]): Record<string, number | undefined> {
  return Object.fromEntries(
    metrics.map((metric) => {
      const value = row[metric];
      return [metric, typeof value === "number" ? value : undefined];
    }),
  );
}

function buildSummaryCsvLines(
  section: DashboardSectionDetail,
  rows: TableRowData[],
  scope: "device" | "interface",
  context: MetricFormatContext,
): string[] {
  const metricLabels = getMetricColumnLabels(section.metrics, context.maxValues);
  const lines: string[] = [
    rowToCsv([`Section: ${section.name} (${section.graphType})`]),
    rowToCsv(["scope", "component_name", ...metricLabels]),
  ];

  for (const row of rows) {
    const values = tableRowValues(row, section.metrics);
    lines.push(
      rowToCsv([
        scope,
        row.deviceName,
        ...section.metrics.map((metric) => formatCsvMetricValue(metric, values[metric], context)),
      ]),
    );
  }

  lines.push("");
  return lines;
}

async function buildSectionCsvBlock(
  section: DashboardSectionDetail,
  range: DateRange,
): Promise<string[]> {
  const sources = await resolveSectionSources(section);

  if (!hasResolvedSources(sources)) {
    return [
      rowToCsv([`Section: ${section.name} (${section.graphType})`]),
      rowToCsv(["No data sources configured for this section."]),
      "",
    ];
  }

  const isSummary = isSummaryGraphType(section.graphType);

  if (isSummary) {
    if (sources.scope === "device") {
      const summary = await fetchDeviceMetricsSummary({
        deviceIds: sources.deviceIds,
        metrics: section.metrics,
        start: range.start,
        end: range.end,
      });
      const rows = buildDeviceTableDataFromSummary(summary, section.metrics, sources.deviceLabels);
      const context = buildMetricFormatContext(
        section.metrics,
        rows.map((row) => tableRowValues(row, section.metrics)),
      );
      return buildSummaryCsvLines(section, rows, "device", context);
    }

    const interfaceKeys = sources.interfaces.map((entry) => entry.metricKey);
    const summary = await fetchInterfaceMetricsSummary({
      interfaces: interfaceKeys,
      metrics: section.metrics,
      start: range.start,
      end: range.end,
    });
    const rows = buildInterfaceTableDataFromSummary(
      summary,
      section.metrics,
      sources.interfaces,
    );
    const context = buildMetricFormatContext(
      section.metrics,
      rows.map((row) => tableRowValues(row, section.metrics)),
    );
    return buildSummaryCsvLines(section, rows, "interface", context);
  }

  if (!isTimeseriesGraphType(section.graphType)) {
    return [
      rowToCsv([`Section: ${section.name} (${section.graphType})`]),
      rowToCsv([`Unsupported chart type: ${section.graphType}`]),
      "",
    ];
  }

  const timeseriesValueSets: Array<Record<string, number | undefined>> = [];
  const timeseriesRows: Array<{
    scope: "device" | "interface";
    entityName: string;
    timestamp: string;
    values: Record<string, number | undefined>;
  }> = [];

  if (sources.scope === "device") {
    const response = await fetchDeviceMetrics({
      deviceIds: sources.deviceIds,
      metrics: section.metrics,
      start: range.start,
      end: range.end,
    });

    for (const entry of response) {
      const entityName =
        sources.deviceLabels[String(entry.deviceId)] ?? `Device ${entry.deviceId}`;

      for (const point of entry.dataPoints) {
        const values = Object.fromEntries(
          section.metrics.map((metric) => [metric, point.values?.[metric]]),
        );
        timeseriesValueSets.push(values);
        timeseriesRows.push({
          scope: "device",
          entityName,
          timestamp: point.timestamp,
          values,
        });
      }
    }
  } else {
    const interfaceKeys = sources.interfaces.map((entry) => entry.metricKey);
    const labelByKey = Object.fromEntries(
      sources.interfaces.map((entry) => [entry.metricKey, entry.label]),
    );
    const response = await fetchInterfaceMetrics({
      interfaces: interfaceKeys,
      metrics: section.metrics,
      start: range.start,
      end: range.end,
    });

    for (const entry of response) {
      const metricKey = `${entry.deviceId}:${entry.ifIndex}`;
      const entityName = labelByKey[metricKey] ?? metricKey;

      for (const point of entry.dataPoints) {
        const values = Object.fromEntries(
          section.metrics.map((metric) => [metric, point.values?.[metric]]),
        );
        timeseriesValueSets.push(values);
        timeseriesRows.push({
          scope: "interface",
          entityName,
          timestamp: point.timestamp,
          values,
        });
      }
    }
  }

  const context = buildMetricFormatContext(section.metrics, timeseriesValueSets);
  const metricLabels = getMetricColumnLabels(section.metrics, context.maxValues);
  const lines: string[] = [
    rowToCsv([`Section: ${section.name} (${section.graphType})`]),
    rowToCsv(["scope", "component_name", "timestamp", ...metricLabels]),
  ];

  for (const row of timeseriesRows) {
    lines.push(
      rowToCsv([
        row.scope,
        row.entityName,
        row.timestamp,
        ...section.metrics.map((metric) =>
          formatCsvMetricValue(metric, row.values[metric], context),
        ),
      ]),
    );
  }

  lines.push("");
  return lines;
}

function downloadCsvFile(content: string, filename: string): void {
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function sanitizeCsvFilename(name: string): string {
  return sanitizePdfFilename(name);
}

export async function exportDashboardToCsv({
  dashboard,
  sections,
  range,
}: {
  dashboard: Dashboard;
  sections: DashboardSectionDetail[];
  range: DateRange;
}): Promise<void> {
  const sortedSections = sortDashboardSections(sections);
  const lines: string[] = [
    rowToCsv(["Dashboard", dashboard.name]),
    rowToCsv(["Description", dashboard.description || ""]),
    rowToCsv([
      "Time range start",
      formatAppChartDateTime(range.start),
      range.start.toISOString(),
    ]),
    rowToCsv(["Time range end", formatAppChartDateTime(range.end), range.end.toISOString()]),
    rowToCsv([
      "Note",
      "Summary sections (table/gauge/horizontal bar) export mean values for the selected period. Memory usage is converted to MB or GB.",
    ]),
    "",
  ];

  for (const section of sortedSections) {
    const block = await buildSectionCsvBlock(section, range);
    lines.push(...block);
  }

  const filename = `${sanitizeCsvFilename(dashboard.name)}.csv`;
  downloadCsvFile(lines.join("\n"), filename);
}
