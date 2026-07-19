# Monitoring Dashboard Charts

A comprehensive suite of reusable React chart components for displaying device metrics with multiple visualization types.

`TimeSeriesChart` and `HeatmapChart` are wired to live data from `GET /api/data/metrics/devices`
(see `frontend/src/lib/metricsApi.ts` and `frontend/src/pages/DeviceDetailsPage.tsx`).
`MetricsTable`, `ComparisonChart`, and `GaugeChart` are still mock-data demos (`frontend/src/lib/mockMetrics.ts`)
and are not currently rendered on the device details page.

## Components

### 1. **TimeSeriesChart** - Multi-Metric Time Series
```tsx
<TimeSeriesChart
  data={timeSeriesData}
  metrics={["cpu_usage", "memory_usage"]}
  metricLabels={{ cpu_usage: "CPU Usage (%)", memory_usage: "Memory Usage (MB)" }}
  title="Performance Metrics Over Time"
  initialStart={metricsRange.start}
  initialEnd={metricsRange.end}
  onDateRangeChange={(start, end) => { /* refetch with new range */ }}
/>
```

**Features:**
- Display multiple metrics on a single chart
- Date **and time** range selector (`datetime-local` inputs via `DateTimeRangeControl`)
- Metric toggle buttons
- Area chart visualization
- Color-coded metrics with gradient fills

**Use Case:** Track multiple performance metrics over time (CPU, Memory, Network)

---

### 2. **MetricsTable** - Tabular Data View
```tsx
<MetricsTable
  data={tableData}
  metrics={["cpu_usage", "memory_usage", "disk_usage"]}
  title="Metrics Summary Table"
  onDeviceIdsChange={(ids) => { /* ... */ }}
  onMetricsChange={(metrics) => { /* ... */ }}
/>
```

**Features:**
- Device inventory with metrics as columns
- Metric toggle buttons
- Device ID filter
- Responsive table layout
- Easy to scan and compare values

**Use Case:** Quick overview of multiple devices and their current metric values

---

### 3. **ComparisonChart** - Single Metric vs Multiple Devices
```tsx
<ComparisonChart
  data={comparisonData}
  deviceNames={["Server-001", "Router-02", "Firewall-01"]}
  title="CPU Usage Comparison Across Devices"
  onDateRangeChange={(start, end) => { /* ... */ }}
/>
```

**Features:**
- Compare one metric across multiple devices
- Each device displayed as a separate line
- Device visibility toggle buttons
- Line chart visualization
- Date range selector
- Identify device outliers and patterns

**Use Case:** Find underperforming or problematic devices (e.g., CPU usage spike on one device)

---

### 4. **GaugeChart** - Real-Time Resource Utilization
```tsx
<GaugeChart
  data={gaugeData}
  title="Resource Utilization Gauges"
  onDeviceIdsChange={(ids) => { /* ... */ }}
  onMetricsChange={(metrics) => { /* ... */ }}
/>
```

**Features:**
- Real-time value gauges (circular displays)
- Warning and critical threshold indicators
- Color-coded status (green/yellow/red)
- Configurable thresholds per metric
- Perfect for RAM, CPU, Disk usage monitoring
- Summary cards with status statistics

**Use Case:** At-a-glance resource usage monitoring with clear threshold visualization

---

### 5. **HeatmapChart** - Device Availability Calendar
```tsx
<HeatmapChart
  data={availabilityData}
  rangeStart={availabilityRange.start}
  rangeEnd={availabilityRange.end}
  title="Device Availability Heatmap"
  onDateRangeChange={(start, end) => { /* refetch with new range */ }}
/>
```

**Features:**
- Calendar-style grid: hour of day on the Y-axis, one column per calendar day on the X-axis
  (similar to classic CA PM / uptime heatmaps)
- Status indicators driven by the backend `status` metric: Up (green), Down (red), No data (blank)
- Date **and time** range selector (`datetime-local` inputs via `DateTimeRangeControl`)
- Summary statistics (up/down/no-data hour counts)
- Interactive cells with date/hour/status tooltips

**Use Case:** Historical device availability tracking, identifying downtime patterns

**Data shape (`AvailabilityCell`):** each cell is one hour bucket for one calendar day, derived
by grouping raw `status` samples by local date + hour. If any sample in the bucket is `0` the
whole hour is marked `"down"`; otherwise if at least one sample is present it's `"up"`; hours with
no samples are left out of `data` and render as blank "no data" cells.

---

## Data Types

### TimeSeriesChartData
```typescript
interface TimeSeriesChartData {
  timestamp: string;
  [metricName: string]: string | number;
}
```

### ComparisonChartData
```typescript
interface ComparisonChartData {
  timestamp: string;
  [deviceName: string]: string | number;
}
```

### TableRowData
```typescript
interface TableRowData {
  deviceId: string;
  deviceName: string;
  [metricName: string]: string | number;
}
```

### GaugeChartData
```typescript
interface GaugeChartData {
  deviceId: string;
  deviceName: string;
  metric: string;
  value: number;
  unit?: string;
  min: number;
  max: number;
  thresholdWarning?: number;
  thresholdCritical?: number;
}
```

### AvailabilityCell
```typescript
interface AvailabilityCell {
  date: string; // yyyy-MM-dd, local calendar date
  hour: number; // 0-23, local hour of day
  status: "up" | "down" | "unknown";
}
```

---

## Mock Data Utilities

The `mockMetrics.ts` file provides utilities to generate realistic mock data:

```typescript
import {
  generateTimeSeriesData,
  generateTableData,
  generateComparisonData,
  generateGaugeData,
  generateHeatmapData,
  generateDeviceMetricData,
} from "@/lib/mockMetrics";

// Generate time series data
const data = generateTimeSeriesData(
  ["1", "2", "3"],           // deviceIds
  ["cpu_usage", "memory_usage"],  // metrics
  startDate,
  endDate
);
```

---

## Integration with DeviceDetailsPage

The `/dashboard/devices/{id}` page (`frontend/src/pages/DeviceDetailsPage.tsx`) currently renders:

1. **Status summary cards** - latest status/CPU/memory sample for the device
2. **Time Series Chart** - live CPU + memory usage with a date/time range control
3. **Heatmap Chart** - live hourly availability derived from the `status` metric

Each chart owns its own `DateTimeRangeControl`; applying a new range calls back up to the page,
which re-fetches `GET /api/data/metrics/devices` for that chart's range and passes the transformed
data + `isLoading`/`error` back down.

### Usage Example
```tsx
const [metricsRange, setMetricsRange] = useState({
  start: new Date(Date.now() - 24 * 60 * 60 * 1000),
  end: new Date(),
});

const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesChartData[]>([]);

useEffect(() => {
  fetchDeviceMetrics({
    deviceIds: [deviceId],
    metrics: ["cpu_usage", "memory_usage", "status"],
    start: metricsRange.start,
    end: metricsRange.end,
  }).then((response) => {
    const points = response[0]?.dataPoints ?? [];
    setTimeSeriesData(points.map((p) => ({
      timestamp: new Date(p.timestamp).toLocaleString(),
      cpu_usage: p.values.cpu_usage,
      memory_usage: p.values.memory_usage / (1024 * 1024),
    })));
  });
}, [deviceId, metricsRange]);

// Render chart
<TimeSeriesChart
  data={timeSeriesData}
  metrics={["cpu_usage", "memory_usage"]}
  title="CPU & Memory Usage"
  initialStart={metricsRange.start}
  initialEnd={metricsRange.end}
  onDateRangeChange={(start, end) => setMetricsRange({ start, end })}
/>
```

---

## Styling

All components follow the existing theme using:
- `shadcn/ui` components (Button, Card, Input, Label)
- Tailwind CSS classes
- CSS variables for colors (`var(--color-*)`)
- Recharts for chart rendering

Colors used in charts:
- Primary: `#8b5cf6` (purple)
- Secondary: `#ec4899` (pink)
- Tertiary: `#3b82f6` (blue)
- Success: `#10b981` (green)
- Warning: `#f59e0b` (amber)
- Danger: `#ef4444` (red)

---

## Backend Integration

`TimeSeriesChart` and `HeatmapChart` are backed by `frontend/src/lib/metricsApi.ts`, which wraps
`GET /api/data/metrics/devices`:

```typescript
import { fetchDeviceMetrics } from "@/lib/metricsApi";

const response = await fetchDeviceMetrics({
  deviceIds: ["3"],
  metrics: ["cpu_usage", "memory_usage", "status"],
  start,
  end,
});
// response: { deviceId: string; dataPoints: { timestamp: string; values: Record<string, number> }[] }[]
```

The `status` field is `1` (up) or `0` (down), written by the poller (`poller/main.py`). The
device details page fetches it alongside `cpu_usage`/`memory_usage` for the status summary cards,
and on its own (over a wider range) for the availability heatmap.

`frontend/src/lib/metricsApi.ts` also exposes `fetchDeviceInfo(deviceId)`, wrapping
`GET /api/devices/{id}`, used to show the device hostname/IP in the page header.

---

## Performance Considerations

1. **Large datasets:** Use time range filters to limit data points
2. **Multiple devices:** Consider pagination or limiting visible devices
3. **Real-time updates:** Implement `setInterval` or WebSocket for live updates
4. **Caching:** Cache metric requests with appropriate TTL
5. **Lazy loading:** Load charts only when needed

---

## Future Enhancements

- [ ] Export chart data to CSV/JSON
- [ ] Chart presets (saved views)
- [ ] Alarm/threshold notifications
- [ ] Drill-down capability
- [ ] Custom chart builder
- [ ] Real-time streaming data
- [ ] Annotations and event markers
- [ ] Predictive analytics overlays
