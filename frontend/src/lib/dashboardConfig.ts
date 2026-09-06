/** Scalable chart type registry — add new entries here to support future chart types. */

export const DASHBOARD_GRAPH_TYPES = [

  {

    id: "per_item",

    label: "Chart per item (multiple metrics)",

    renderer: "timeseries" as const,

    layout: "per_item" as const,

  },

  {

    id: "per_metric",

    label: "Chart per metric (multiple items)",

    renderer: "timeseries" as const,

    layout: "per_metric" as const,

  },

  { id: "gauge", label: "Gauge chart", renderer: "gauge" as const, layout: null },

  { id: "horizontal_bar", label: "Horizontal bar chart", renderer: "horizontal_bar" as const, layout: null },

  { id: "table", label: "Table", renderer: "table" as const, layout: null },

] as const;



export type DashboardGraphTypeId = (typeof DASHBOARD_GRAPH_TYPES)[number]["id"];



export type DashboardTimeseriesLayout = "per_item" | "per_metric";



export const DASHBOARD_SOURCE_TYPES = [

  { id: "DEVICE_LIST", label: "Devices", scope: "device" as const },

  { id: "DEVICE_GROUP", label: "Device group", scope: "device" as const },

  { id: "INTERFACE_LIST", label: "Interfaces", scope: "interface" as const },

  { id: "INTERFACE_GROUP", label: "Interface group", scope: "interface" as const },

] as const;



export type DashboardSourceTypeId = (typeof DASHBOARD_SOURCE_TYPES)[number]["id"];



export type DashboardMetricScope = "device" | "interface";



export type MetricScaleType = "bytes" | "bps";



export interface DashboardMetricDefinition {

  key: string;

  label: string;

  scope: DashboardMetricScope;

  unit?: string;

  scaleType?: MetricScaleType;

  /** When true, values are percentages suitable for gauge max=100. */

  isPercentage?: boolean;

  /** When true, values come from the Influx `status` field (0 = down, 1 = up). */

  isAvailability?: boolean;

}



/** Scalable metric registry — add new metrics here as they become available. */

export const DASHBOARD_METRICS: DashboardMetricDefinition[] = [

  {

    key: "cpu_usage",

    label: "CPU usage (%)",

    scope: "device",

    unit: "%",

    isPercentage: true,

  },

  {

    key: "memory_usage",

    label: "Memory usage (raw)",

    scope: "device",

    scaleType: "bytes",

  },

  {

    key: "memory_usage_pct",

    label: "Memory usage (%)",

    scope: "device",

    unit: "%",

    isPercentage: true,

  },

  {

    key: "status",

    label: "Availability",

    scope: "device",

    unit: "%",

    isAvailability: true,

  },

  {

    key: "in_util_pct",

    label: "Inbound utilization (%)",

    scope: "interface",

    unit: "%",

    isPercentage: true,

  },

  {

    key: "out_util_pct",

    label: "Outbound utilization (%)",

    scope: "interface",

    unit: "%",

    isPercentage: true,

  },

  {

    key: "in_bps",

    label: "Inbound speed (bps)",

    scope: "interface",

    unit: "bps",

    scaleType: "bps",

  },

  {

    key: "out_bps",

    label: "Outbound speed (bps)",

    scope: "interface",

    unit: "bps",

    scaleType: "bps",

  },

];



const LEGACY_GRAPH_TYPE_LABELS: Record<string, string> = {

  line: "Normal chart (legacy)",

};



export function getGraphTypeLabel(graphType: string): string {

  return (

    DASHBOARD_GRAPH_TYPES.find((entry) => entry.id === graphType)?.label ??

    LEGACY_GRAPH_TYPE_LABELS[graphType] ??

    graphType

  );

}



export function getSourceTypeLabel(sourceType: string): string {

  return DASHBOARD_SOURCE_TYPES.find((entry) => entry.id === sourceType)?.label ?? sourceType;

}



export function getMetricsForScope(scope: DashboardMetricScope): DashboardMetricDefinition[] {

  return DASHBOARD_METRICS.filter((metric) => metric.scope === scope);

}



export function getMetricDefinition(key: string): DashboardMetricDefinition | undefined {

  return DASHBOARD_METRICS.find((metric) => metric.key === key);

}



export function getMetricLabels(keys: string[]): Record<string, string> {

  return Object.fromEntries(

    keys.flatMap((key) => {

      const definition = getMetricDefinition(key);

      return definition ? [[key, definition.label]] : [[key, key]];

    }),

  );

}



export function getSourceScope(sourceType: string): DashboardMetricScope {

  const entry = DASHBOARD_SOURCE_TYPES.find((item) => item.id === sourceType);

  return entry?.scope ?? "device";

}



/** Maps stored graphType (+ legacy values) to a timeseries layout. */

export function resolveTimeseriesLayout(

  graphType: string,

  entityCount: number,

): DashboardTimeseriesLayout {

  if (graphType === "per_item") {

    return "per_item";

  }



  if (graphType === "per_metric" || graphType === "line") {

    return "per_metric";

  }



  return entityCount <= 1 ? "per_item" : "per_metric";

}



export function isTimeseriesGraphType(graphType: string): boolean {

  return (

    graphType === "per_item" ||

    graphType === "per_metric" ||

    graphType === "line"

  );

}



export function isSummaryGraphType(graphType: string): boolean {

  return graphType === "table" || graphType === "gauge" || graphType === "horizontal_bar";

}


