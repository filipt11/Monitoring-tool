import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, Network, Search, XCircle } from "lucide-react";
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
import {
  fetchInterfaceCatalog,
  type InterfaceGroupMember,
} from "@/lib/interfaceGroupsApi";
import { formatBpsValue } from "@/lib/formatBps";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

type SortKey =
  | "name"
  | "deviceHostname"
  | "deviceIp"
  | "ifIndex"
  | "adminStatus"
  | "operStatus"
  | "speedBps";
type SortDirection = "asc" | "desc";

function formatInterfaceStatus(status: string | null | undefined) {
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function InterfaceStatusBadge({ status }: { status: string | null | undefined }) {
  const isUp = status === "up";
  const isDown = status === "down";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        isUp
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : isDown
            ? "border-destructive/30 bg-destructive/10 text-destructive"
            : "border-border bg-muted/30 text-muted-foreground",
      )}
    >
      {isUp ? (
        <CheckCircle2 className="size-3.5" />
      ) : isDown ? (
        <XCircle className="size-3.5" />
      ) : null}
      {formatInterfaceStatus(status)}
    </span>
  );
}

export function InterfacesPage() {
  const [interfaces, setInterfaces] = useState<InterfaceGroupMember[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    let active = true;

    async function loadInterfaces() {
      setLoading(true);
      setError(null);

      try {
        const catalog = await fetchInterfaceCatalog();
        if (active) {
          setInterfaces(catalog.content);
        }
      } catch (fetchError) {
        if (active) {
          setInterfaces([]);
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load interfaces.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadInterfaces();

    return () => {
      active = false;
    };
  }, []);

  const filteredInterfaces = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const safeInterfaces = Array.isArray(interfaces) ? interfaces : [];

    const searchedInterfaces = normalizedQuery
      ? safeInterfaces.filter((iface) => {
          const speedText =
            iface.speedBps != null ? formatBpsValue(iface.speedBps).text : "";
          const haystack = [
            iface.name,
            iface.deviceHostname,
            iface.deviceIp,
            String(iface.ifIndex),
            iface.adminStatus,
            iface.operStatus,
            iface.mac ?? "",
            speedText,
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(normalizedQuery);
        })
      : safeInterfaces;

    const sortedInterfaces = [...searchedInterfaces].sort((left, right) => {
      if (sortKey === "ifIndex" || sortKey === "speedBps") {
        const leftValue = left[sortKey] ?? -1;
        const rightValue = right[sortKey] ?? -1;

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

    return sortedInterfaces;
  }, [interfaces, query, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filteredInterfaces.length / pageSize));
  const pagedInterfaces = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredInterfaces.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filteredInterfaces]);

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
        <h2 className="text-2xl font-semibold tracking-tight">Interfaces</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Browse discovered interfaces and open their detail view.
        </p>
      </div>

      <Card className="border-border/60">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Network className="size-5" />
                Interface inventory
              </CardTitle>
              <CardDescription>
                Catalog of interfaces discovered across all monitored devices.
              </CardDescription>
            </div>

            <div className="relative w-full md:max-w-sm">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, device, or IP"
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
              Loading interfaces...
            </div>
          ) : filteredInterfaces.length === 0 ? (
            <div className="text-muted-foreground flex min-h-40 items-center justify-center rounded-lg border border-dashed text-sm">
              No interfaces match your search.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full table-fixed divide-y divide-border text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">
                        <button
                          className="flex items-center hover:text-foreground"
                          onClick={() => toggleSort("name")}
                          type="button"
                        >
                          Interface
                          {renderSortIcon("name")}
                        </button>
                      </th>
                      <th className="w-[16%] px-4 py-3 text-left font-medium">
                        <button
                          className="flex items-center hover:text-foreground"
                          onClick={() => toggleSort("deviceHostname")}
                          type="button"
                        >
                          Device
                          {renderSortIcon("deviceHostname")}
                        </button>
                      </th>
                      <th className="w-[14%] px-4 py-3 text-left font-medium">
                        <button
                          className="flex items-center hover:text-foreground"
                          onClick={() => toggleSort("deviceIp")}
                          type="button"
                        >
                          IP address
                          {renderSortIcon("deviceIp")}
                        </button>
                      </th>
                      <th className="w-[10%] px-4 py-3 text-left font-medium">
                        <button
                          className="flex items-center hover:text-foreground"
                          onClick={() => toggleSort("ifIndex")}
                          type="button"
                        >
                          Index
                          {renderSortIcon("ifIndex")}
                        </button>
                      </th>
                      <th className="w-[12%] px-4 py-3 text-left font-medium">
                        <button
                          className="flex items-center hover:text-foreground"
                          onClick={() => toggleSort("adminStatus")}
                          type="button"
                        >
                          Admin
                          {renderSortIcon("adminStatus")}
                        </button>
                      </th>
                      <th className="w-[12%] px-4 py-3 text-left font-medium">
                        <button
                          className="flex items-center hover:text-foreground"
                          onClick={() => toggleSort("operStatus")}
                          type="button"
                        >
                          Oper
                          {renderSortIcon("operStatus")}
                        </button>
                      </th>
                      <th className="w-[14%] px-4 py-3 text-left font-medium">
                        <button
                          className="flex items-center hover:text-foreground"
                          onClick={() => toggleSort("speedBps")}
                          type="button"
                        >
                          Speed
                          {renderSortIcon("speedBps")}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-background/80">
                    {pagedInterfaces.map((iface) => (
                      <tr key={iface.id} className="hover:bg-muted/40">
                        <td className="px-4 py-3">
                          <Button variant="link" className="h-auto p-0 text-sm" asChild>
                            <Link to={routes.interfaceDetails(String(iface.id))}>
                              {iface.name}
                            </Link>
                          </Button>
                        </td>
                        <td className="px-4 py-3">
                          <Button variant="link" className="text-muted-foreground h-auto p-0 text-sm" asChild>
                            <Link to={routes.deviceDetails(String(iface.deviceId))}>
                              {iface.deviceHostname}
                            </Link>
                          </Button>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {iface.deviceIp}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{iface.ifIndex}</td>
                        <td className="px-4 py-3">
                          <InterfaceStatusBadge status={iface.adminStatus} />
                        </td>
                        <td className="px-4 py-3">
                          <InterfaceStatusBadge status={iface.operStatus} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {iface.speedBps != null
                            ? formatBpsValue(iface.speedBps).text
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-muted-foreground text-sm">
                  Showing {Math.min((currentPage - 1) * pageSize + 1, filteredInterfaces.length)}-{Math.min(currentPage * pageSize, filteredInterfaces.length)} of {filteredInterfaces.length} interfaces
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
