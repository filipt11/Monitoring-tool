import type {
  ComparisonChartData,
  DeviceMetricData,
  GaugeChartData,
  HeatmapCell,
  TableRowData,
  TimeSeriesChartData,
} from "./charts.types";

export function generateTimeSeriesData(
  _deviceIds: string[],
  metrics: string[],
  startDate: Date,
  endDate: Date,
): TimeSeriesChartData[] {
  const data: TimeSeriesChartData[] = [];
  const intervalMs = (endDate.getTime() - startDate.getTime()) / 20;

  for (let i = 0; i < 20; i++) {
    const timestamp = new Date(startDate.getTime() + i * intervalMs);
    const row: TimeSeriesChartData = {
      timestamp: timestamp.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    metrics.forEach((metric) => {
      const baseValue =
        metric === "cpu_usage"
          ? 30 + Math.sin(i / 5) * 20 + Math.random() * 10
          : metric === "memory_usage"
            ? 40 + Math.cos(i / 4) * 15 + Math.random() * 8
            : metric === "disk_usage"
              ? 50 + Math.random() * 20
              : 20 + Math.random() * 30;

      row[metric] = Math.max(0, Math.min(100, Math.round(baseValue)));
    });

    data.push(row);
  }

  return data;
}

export function generateComparisonData(
  deviceIds: string[],
  metric: string,
  startDate: Date,
  endDate: Date,
): ComparisonChartData[] {
  const deviceNames = [
    "Server-001",
    "Router-02",
    "Firewall-01",
    "Switch-03",
    "Gateway-04",
  ];

  const data: ComparisonChartData[] = [];
  const intervalMs = (endDate.getTime() - startDate.getTime()) / 15;

  for (let i = 0; i < 15; i++) {
    const timestamp = new Date(startDate.getTime() + i * intervalMs);
    const row: ComparisonChartData = {
      timestamp: timestamp.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    deviceIds.forEach((_deviceId, idx) => {
      const deviceName = deviceNames[idx % deviceNames.length];
      const baseValue =
        metric === "cpu_usage"
          ? 25 + Math.sin((i + idx * 2) / 4) * 25 + Math.random() * 10
          : metric === "memory_usage"
            ? 35 + Math.cos((i + idx * 2) / 3) * 20 + Math.random() * 8
            : metric === "network_in"
              ? 100 + Math.random() * 200
              : 50 + Math.random() * 30;

      row[deviceName] = Math.max(0, Math.min(100, Math.round(baseValue)));
    });

    data.push(row);
  }

  return data;
}

export function generateTableData(
  deviceIds: string[],
  metrics: string[],
): TableRowData[] {
  const deviceNames = [
    "core-router-01",
    "switch-edge-02",
    "firewall-main",
    "gateway-srv-01",
    "monitor-node-05",
  ];

  return deviceIds.map((deviceId, idx) => {
    const row: TableRowData = {
      deviceId,
      deviceName: deviceNames[idx % deviceNames.length],
    };

    metrics.forEach((metric) => {
      const baseValue =
        metric === "cpu_usage"
          ? 25 + Math.random() * 40
          : metric === "memory_usage"
            ? 35 + Math.random() * 35
            : metric === "disk_usage"
              ? 45 + Math.random() * 30
              : metric === "network_in"
                ? 100 + Math.random() * 500
                : metric === "network_out"
                  ? 80 + Math.random() * 400
                  : 20 + Math.random() * 50;

      row[metric] = Math.round(baseValue);
    });

    return row;
  });
}

export function generateGaugeData(
  deviceIds: string[],
  metrics: string[],
): GaugeChartData[] {
  const deviceNames = [
    "Server-001",
    "Router-02",
    "Firewall-01",
    "Switch-03",
  ];

  const metricConfig: Record<string, { max: number; unit: string; warning: number; critical: number }> = {
    cpu_usage: { max: 100, unit: "%", warning: 70, critical: 90 },
    memory_usage: { max: 100, unit: "%", warning: 75, critical: 90 },
    disk_usage: { max: 100, unit: "%", warning: 80, critical: 95 },
    network_utilization: { max: 100, unit: "%", warning: 70, critical: 85 },
  };

  const data: GaugeChartData[] = [];

  deviceIds.forEach((deviceId, deviceIdx) => {
    metrics.forEach((metric) => {
      const config = metricConfig[metric] || { max: 100, unit: "%", warning: 70, critical: 90 };
      const value = Math.random() * (config.max * 0.8);

      data.push({
        deviceId,
        deviceName: deviceNames[deviceIdx % deviceNames.length],
        metric,
        value: Math.round(value),
        unit: config.unit,
        min: 0,
        max: config.max,
        thresholdWarning: config.warning,
        thresholdCritical: config.critical,
      });
    });
  });

  return data;
}

export function generateHeatmapData(
  deviceIds: string[],
  days: number = 7,
): HeatmapCell[] {
  const deviceNames = [
    "core-router-01",
    "switch-edge-02",
    "firewall-main",
    "gateway-srv-01",
    "monitor-node-05",
  ];

  const statuses = ["up", "down", "warning", "unknown"] as const;
  const statusWeights = { up: 0.7, warning: 0.2, down: 0.05, unknown: 0.05 };
  const data: HeatmapCell[] = [];

  const now = new Date();
  const bucketsPerDay = 4; // 6-hour buckets instead of hourly

  for (let day = 0; day < days; day++) {
    for (let bucket = 0; bucket < bucketsPerDay; bucket++) {
      const timestamp = new Date(now.getTime() - (days - day) * 24 * 60 * 60 * 1000 + bucket * 6 * 60 * 60 * 1000);

      deviceIds.forEach((deviceId, idx) => {
        const rand = Math.random();
        let status: typeof statuses[number] = "up";

        if (rand < statusWeights.down) {
          status = "down";
        } else if (rand < statusWeights.down + statusWeights.warning) {
          status = "warning";
        } else if (rand < statusWeights.down + statusWeights.warning + statusWeights.unknown) {
          status = "unknown";
        }

        data.push({
          deviceId,
          deviceName: deviceNames[idx % deviceNames.length],
          timestamp: timestamp.toISOString(),
          status,
          value: status === "up" ? 100 : status === "warning" ? 50 : 0,
        });
      });
    }
  }

  return data;
}

export function generateDeviceMetricData(
  deviceId: string,
  metric: string,
  startDate: Date,
  endDate: Date,
): DeviceMetricData {
  const deviceNames = ["Server-001", "Router-02", "Firewall-01", "Switch-03"];
  const dataPoints = [];
  const intervalMs = (endDate.getTime() - startDate.getTime()) / 30;

  for (let i = 0; i < 30; i++) {
    const timestamp = new Date(startDate.getTime() + i * intervalMs);
    const baseValue =
      metric === "cpu_usage"
        ? 30 + Math.sin(i / 5) * 20 + Math.random() * 10
        : metric === "memory_usage"
          ? 40 + Math.cos(i / 4) * 15 + Math.random() * 8
          : 50 + Math.random() * 20;

    dataPoints.push({
      timestamp: timestamp.toISOString(),
      value: Math.max(0, Math.min(100, baseValue)),
    });
  }

  return {
    deviceId,
    deviceName: deviceNames[parseInt(deviceId) % deviceNames.length],
    metricName: metric,
    unit: metric.includes("usage") || metric.includes("utilization") ? "%" : "units",
    dataPoints,
  };
}
