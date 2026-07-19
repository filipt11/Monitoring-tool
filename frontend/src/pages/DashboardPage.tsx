import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Server,
  Wifi,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/api/client";

interface MetricPoint {
  timestamp: string;
  values: Record<string, number>;
}

interface DeviceMetrics {
  deviceId: string;
  dataPoints: MetricPoint[];
}

type MetricChartPoint = {
  time: string;
  cpu_usage: number;
};

const statCards = [
  {
    title: "Active devices",
    value: "24",
    change: "+3 this week",
    icon: Server,
  },
  {
    title: "Healthy interfaces",
    value: "96%",
    change: "Stable",
    icon: CheckCircle2,
  },
  {
    title: "Open alerts",
    value: "2",
    change: "Needs attention",
    icon: AlertTriangle,
  },
  {
    title: "Avg. throughput",
    value: "52 Mbps",
    change: "+8% vs yesterday",
    icon: Wifi,
  },
];

export function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.authorities.some(
    (authority) => authority.authority === "ROLE_ADMIN",
  );
  const [metrics, setMetrics] = useState<MetricChartPoint[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadMetrics() {
      setMetricsLoading(true);
      setMetricsError(null);

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 15 * 60 * 1000);
      const query = new URLSearchParams({
        deviceIds: "3",
        metrics: "cpu_usage",
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      }).toString();

      try {
        const data = await apiFetch<DeviceMetrics[]>(
          `/api/data/metrics/devices?${query}`,
        );

        if (!active) {
          return;
        }

        const deviceMetrics = data[0];

        if (!deviceMetrics?.dataPoints?.length) {
          setMetrics([]);
          setMetricsError("No CPU metrics found for device 3.");
          return;
        }

        const chartData = deviceMetrics.dataPoints.map((point) => ({
          time: new Date(point.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          cpu_usage: point.values?.cpu_usage ?? 0,
        }));

        setMetrics(chartData);
      } catch (error) {
        setMetricsError(
          error instanceof Error ? error.message : "Failed to load CPU metrics.",
        );
      } finally {
        setMetricsLoading(false);
      }
    }

    void loadMetrics();

    return () => {
      active = false;
    };
  }, []);

  const metricData = useMemo<MetricChartPoint[]>(
    () =>
      metrics.length > 0
        ? metrics
        : [
            { time: "12:00", cpu_usage: 0 },
            { time: "12:01", cpu_usage: 0 },
            { time: "12:02", cpu_usage: 0 },
          ],
    [metrics],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Welcome back, {user?.username}
        </h2>
        <p className="text-muted-foreground max-w-2xl text-sm">
          This is your monitoring home base. Charts below use sample data for
          now — we&apos;ll wire them to live metrics from the backend next.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ title, value, change, icon: Icon }) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              <Icon className="text-muted-foreground size-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
              <p className="text-muted-foreground text-xs">{change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Network throughput</CardTitle>
            <CardDescription>
              Sample 24h trend — Recharts is ready for real API data
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            {metricsLoading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Loading CPU metrics...
              </div>
            ) : metricsError ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
                {metricsError}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metricData}>
                  <defs>
                    <linearGradient id="throughputFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="var(--color-chart-1)"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--color-chart-1)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis
                    dataKey="time"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-popover)",
                      borderColor: "var(--color-border)",
                      borderRadius: "0.5rem",
                      color: "var(--color-popover-foreground)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cpu_usage"
                    stroke="var(--color-chart-1)"
                    fill="url(#throughputFill)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session</CardTitle>
            <CardDescription>Your authenticated profile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full">
                <Activity className="size-5" />
              </div>
              <div>
                <p className="font-medium">{user?.username}</p>
                <p className="text-muted-foreground text-xs">{user?.email}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Role</span>
                <span>{user?.authorities[0]?.authority ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Admin access</span>
                <span>{isAdmin ? "Yes" : "No"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account status</span>
                <span>{user?.isBanned ? "Banned" : "Active"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
