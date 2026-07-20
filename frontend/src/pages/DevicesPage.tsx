import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, Search, Server, XCircle } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchDeviceList, type DeviceRecord } from "@/lib/devicesApi";
import {
  DEVICE_STATUS_UP,
  extractLatestMetrics,
  fetchDeviceMetrics,
  statusLabel,
} from "@/lib/metricsApi";
import { routes } from "@/lib/routes";

interface DeviceRow extends DeviceRecord {
  status?: number;
}

const METRICS_LOOKBACK_MS = 15 * 60 * 1000;

type SortKey = "hostname" | "ipAddress" | "type" | "status";
type SortDirection = "asc" | "desc";

export function DevicesPage() {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("hostname");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    let active = true;

    async function loadDevices() {
      setLoading(true);
      setError(null);

      try {
        const { devices: deviceList } = await fetchDeviceList(query);
        if (!active) return;

        if (deviceList.length === 0) {
          setDevices([]);
          return;
        }

        const end = new Date();
        const start = new Date(end.getTime() - METRICS_LOOKBACK_MS);

        let devicesWithStatus: DeviceRow[] = deviceList;

        try {
          const metricsResponse = await fetchDeviceMetrics({
            deviceIds: deviceList.map((device) => String(device.id)),
            metrics: ["status"],
            start,
            end,
          });

          if (!active) return;

          const metricsByDevice = extractLatestMetrics(metricsResponse);
          devicesWithStatus = deviceList.map((device) => ({
            ...device,
            status: metricsByDevice.get(String(device.id))?.status,
          }));
        } catch (metricsError) {
          if (import.meta.env.DEV) {
            console.warn("Device status metrics unavailable", metricsError);
          }
        }

        setDevices(devicesWithStatus);
      } catch (fetchError) {
        if (active) {
          setDevices([]);
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load devices.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDevices();

    return () => {
      active = false;
    };
  }, [query]);

  const filteredDevices = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const safeDevices = Array.isArray(devices) ? devices : [];

    const searchedDevices = normalizedQuery
      ? safeDevices.filter((device) => {
          const haystack = `${device.hostname} ${device.ipAddress} ${device.type ?? ""} ${statusLabel(device.status)}`.toLowerCase();
          return haystack.includes(normalizedQuery);
        })
      : safeDevices;

    const sortedDevices = [...searchedDevices].sort((left, right) => {
      if (sortKey === "status") {
        const leftValue = left.status ?? -1;
        const rightValue = right.status ?? -1;

        if (leftValue < rightValue) {
          return sortDirection === "asc" ? -1 : 1;
        }

        if (leftValue > rightValue) {
          return sortDirection === "asc" ? 1 : -1;
        }

        return 0;
      }

      const leftValue = (left[sortKey] ?? "").toString().toLowerCase();
      const rightValue = (right[sortKey] ?? "").toString().toLowerCase();

      if (leftValue < rightValue) {
        return sortDirection === "asc" ? -1 : 1;
      }

      if (leftValue > rightValue) {
        return sortDirection === "asc" ? 1 : -1;
      }

      return 0;
    });

    return sortedDevices;
  }, [devices, query, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filteredDevices.length / pageSize));
  const pagedDevices = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredDevices.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filteredDevices]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, sortKey, sortDirection]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return null;
    }

    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 size-3" />
    ) : (
      <ArrowDown className="ml-1 size-3" />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">Devices</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Browse connected devices and open their detail view.
        </p>
      </div>

      <Card className="border-border/60">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Server className="size-5" />
                Device inventory
              </CardTitle>
              <CardDescription>
                Status is based on the latest monitoring sample from the last 15 minutes.
              </CardDescription>
            </div>

            <div className="relative w-full md:max-w-sm">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by hostname or IP"
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="mb-4 flex min-h-40 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
              {error}
            </div>
          ) : loading ? (
            <div className="text-muted-foreground flex min-h-40 items-center justify-center rounded-lg border border-dashed text-sm">
              Loading devices...
            </div>
          ) : filteredDevices.length === 0 ? (
            <div className="text-muted-foreground flex min-h-40 items-center justify-center rounded-lg border border-dashed text-sm">
              No devices match your search.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-lg border">
                <table className="min-w-full table-fixed divide-y divide-border text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">
                        <button
                          className="flex items-center hover:text-foreground"
                          onClick={() => toggleSort("hostname")}
                          type="button"
                        >
                          Hostname
                          {renderSortIcon("hostname")}
                        </button>
                      </th>
                      <th className="w-[22%] px-4 py-3 text-left font-medium">
                        <button
                          className="flex items-center hover:text-foreground"
                          onClick={() => toggleSort("ipAddress")}
                          type="button"
                        >
                          IP address
                          {renderSortIcon("ipAddress")}
                        </button>
                      </th>
                      <th className="w-[25%] px-4 py-3 text-left font-medium">
                        <button
                          className="flex items-center hover:text-foreground"
                          onClick={() => toggleSort("type")}
                          type="button"
                        >
                          Model
                          {renderSortIcon("type")}
                        </button>
                      </th>
                      <th className="w-[15%] px-4 py-3 text-left font-medium">
                        <button
                          className="flex items-center hover:text-foreground"
                          onClick={() => toggleSort("status")}
                          type="button"
                        >
                          Status
                          {renderSortIcon("status")}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-background/80">
                    {pagedDevices.map((device) => {
                      const isOnline = device.status === DEVICE_STATUS_UP;
                      const isOffline = device.status === 0;

                      return (
                        <tr key={device.id} className="hover:bg-muted/40">
                          <td className="px-4 py-3">
                            <Button variant="link" className="h-auto p-0 text-sm" asChild>
                              <Link to={routes.deviceDetails(String(device.id))}>
                                {device.hostname}
                              </Link>
                            </Button>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {device.ipAddress}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {device.type ?? "—"}
                          </td>
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-muted-foreground text-sm">
                  Showing {Math.min((currentPage - 1) * pageSize + 1, filteredDevices.length)}-{Math.min(currentPage * pageSize, filteredDevices.length)} of {filteredDevices.length} devices
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
