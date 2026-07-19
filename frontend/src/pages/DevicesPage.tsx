import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search, Server } from "lucide-react";
import { Link } from "react-router-dom";

import { apiFetch } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface DeviceRecord {
  id: number;
  hostname: string;
  ipAddress: string;
  type?: string;
  status?: string;
}

const fallbackDevices: DeviceRecord[] = [
  {
    id: 1,
    hostname: "core-router-01",
    ipAddress: "10.0.0.1",
    type: "Router",
    status: "Online",
  },
  {
    id: 2,
    hostname: "switch-edge-02",
    ipAddress: "10.0.0.12",
    type: "Switch",
    status: "Online",
  },
  {
    id: 3,
    hostname: "firewall-main",
    ipAddress: "10.0.0.254",
    type: "Firewall",
    status: "Warning",
  },
];

function normalizeDevices(payload: unknown): DeviceRecord[] {
  if (Array.isArray(payload)) {
    return payload.flatMap((item) => {
      if (typeof item !== "object" || item === null) {
        return [];
      }

      const data = item as Record<string, unknown>;
      const vendor = typeof data.vendor === "string" ? data.vendor : undefined;
      const model = typeof data.model === "string" ? data.model : undefined;
      const type =
        typeof data.type === "string"
          ? data.type
          : [vendor, model].filter(Boolean).join(" / ") || undefined;

      return [
        {
          id: Number(data.id ?? data.deviceId ?? 0) || Date.now() + Math.random(),
          hostname: String(data.hostname ?? data.name ?? "Unnamed device"),
          ipAddress: String(data.ipAddress ?? data.ip ?? data.address ?? "Unknown"),
          type,
          status: typeof data.status === "string" ? data.status : "Online",
        },
      ];
    });
  }

  if (payload && typeof payload === "object") {
    const data = payload as Record<string, unknown>;
    const nestedCandidates = [data.content, data.devices, data.items, data.data];

    for (const nested of nestedCandidates) {
      if (Array.isArray(nested)) {
        return normalizeDevices(nested);
      }
    }
  }

  return [];
}

type SortKey = "hostname" | "ipAddress" | "type" | "status";
type SortDirection = "asc" | "desc";

export function DevicesPage() {
  const [devices, setDevices] = useState<DeviceRecord[]>(fallbackDevices);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("hostname");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    let active = true;

    async function loadDevices() {
      setLoading(true);
      setNotice(null);

      const trimmedQuery = query.trim();
      const searchPaths = trimmedQuery
        ? [
            `/api/devices/search/hostname?name=${encodeURIComponent(trimmedQuery)}`,
            `/api/devices/search/ip?ip=${encodeURIComponent(trimmedQuery)}`,
          ]
        : ["/api/devices"];

      let lastError: unknown = null;

      for (const path of searchPaths) {
        try {
          const data = await apiFetch<unknown>(path);
          const normalizedDevices = normalizeDevices(data);

          if (active && normalizedDevices.length > 0) {
            setDevices(normalizedDevices);
            setNotice(null);
            setLoading(false);
            return;
          }

          // If this endpoint returned no devices, keep trying other search paths.
          if (active && Array.isArray(data) && normalizedDevices.length === 0) {
            continue;
          }
        } catch (error) {
          lastError = error;
        }
      }

      if (active) {
        const filteredFallback = trimmedQuery
          ? fallbackDevices.filter((device) => {
              const haystack = `${device.hostname} ${device.ipAddress} ${device.type ?? ""} ${device.status ?? ""}`.toLowerCase();
              return haystack.includes(trimmedQuery.toLowerCase());
            })
          : fallbackDevices;

        setDevices(filteredFallback);
        setNotice(
          trimmedQuery
            ? "Search endpoints are unavailable, so sample results are shown."
            : "The backend is unavailable right now, so sample devices are shown.",
        );
      }

      if (active) {
        if (lastError && import.meta.env.DEV) {
          console.warn("Devices endpoint unavailable, using demo data", lastError);
        }
        setLoading(false);
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
          const haystack = `${device.hostname} ${device.ipAddress} ${device.type ?? ""} ${device.status ?? ""}`.toLowerCase();
          return haystack.includes(normalizedQuery);
        })
      : safeDevices;

    const sortedDevices = [...searchedDevices].sort((left, right) => {
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
                The list tries the backend search endpoints first and falls back to
                sample data when the API is unavailable.
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
          {notice ? (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
              {notice}
            </div>
          ) : null}

          {loading ? (
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
                    {pagedDevices.map((device) => (
                      <tr key={device.id} className="hover:bg-muted/40">
                        <td className="px-4 py-3">
                          <Button variant="link" className="h-auto p-0 text-sm" asChild>
                            <Link to={`/dashboard/devices/${device.id}`}>
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
                          <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                            {device.status ?? "Online"}
                          </span>
                        </td>
                      </tr>
                    ))}
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
