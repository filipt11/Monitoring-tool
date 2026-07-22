import { useMemo } from "react";
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AvailabilityCell } from "@/lib/charts.types";

interface HeatmapChartProps {
  data: AvailabilityCell[];
  rangeStart: Date;
  rangeEnd: Date;
  title: string;
  description?: string;
  isLoading?: boolean;
  error?: string | null;
}

const WEEKDAY_LETTERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MAX_DAYS = 62;

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatCompactHour(hour: number): string {
  return `${pad(hour)}:00`;
}

function formatHourRange(hour: number): string {
  return `${formatCompactHour(hour)} – ${formatCompactHour((hour + 1) % 24)}`;
}

function cellClassName(status: "up" | "down" | "unknown" | undefined): string {
  switch (status) {
    case "up":
      return "bg-emerald-500/85 hover:bg-emerald-500";
    case "down":
      return "bg-destructive/85 hover:bg-destructive";
    default:
      return "bg-muted/40 border border-border/50";
  }
}

export const HeatmapChart = React.memo(function HeatmapChart({
  data,
  rangeStart,
  rangeEnd,
  title,
  description,
  isLoading = false,
  error = null,
}: HeatmapChartProps) {
  const days = useMemo(() => {
    const start = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate());
    const end = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate());

    const result: { key: string; weekday: string; dayNumber: number }[] = [];
    const cursor = new Date(start);
    let guard = 0;

    while (cursor.getTime() <= end.getTime() && guard < MAX_DAYS) {
      result.push({
        key: dateKey(cursor),
        weekday: WEEKDAY_LETTERS[cursor.getDay()],
        dayNumber: cursor.getDate(),
      });
      cursor.setDate(cursor.getDate() + 1);
      guard += 1;
    }

    return result;
  }, [rangeStart, rangeEnd]);

  const hours = useMemo(() => Array.from({ length: 24 }, (_, hour) => hour), []);

  const statusByCell = useMemo(() => {
    const map = new Map<string, "up" | "down" | "unknown">();
    data.forEach((cell) => {
      map.set(`${cell.date}_${cell.hour}`, cell.status);
    });
    return map;
  }, [data]);

  const stats = useMemo(() => {
    const counts = { up: 0, down: 0, unknown: 0 };
    days.forEach((day) => {
      for (let hour = 0; hour < 24; hour++) {
        const status = statusByCell.get(`${day.key}_${hour}`);
        if (status === "up") counts.up++;
        else if (status === "down") counts.down++;
        else counts.unknown++;
      }
    });
    return counts;
  }, [days, statusByCell]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-3.5 w-5 rounded-sm bg-emerald-500/85" />
            <span>Up</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3.5 w-5 rounded-sm bg-destructive/85" />
            <span>Down</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3.5 w-5 rounded-sm border border-border/50 bg-muted/40" />
            <span>No data</span>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            Loading heatmap data...
          </div>
        ) : days.length === 0 ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed py-8 text-sm text-muted-foreground">
            No heatmap data available.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[42rem] border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 w-[4.5rem] border-b border-border bg-muted/50 px-2.5 py-1.5 text-left text-[11px] font-medium">
                    Day
                  </th>
                  {hours.map((hour) => (
                    <th
                      key={hour}
                      className="border-b border-border bg-muted/50 px-0.5 py-1.5 text-center text-[10px] leading-none font-medium text-muted-foreground"
                    >
                      {hour % 3 === 0 ? formatCompactHour(hour) : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day.key}>
                    <td className="sticky left-0 z-10 whitespace-nowrap border-b border-border/60 bg-muted/20 px-2.5 py-1 text-left text-xs font-medium">
                      <span className="text-muted-foreground">{day.weekday}</span> {day.dayNumber}
                    </td>
                    {hours.map((hour) => {
                      const status = statusByCell.get(`${day.key}_${hour}`);
                      return (
                        <td key={`${day.key}-${hour}`} className="border-b border-border/40 p-0.5">
                          <div
                            className={`h-4 w-full min-w-[1rem] rounded-[3px] transition-colors ${cellClassName(status)}`}
                            title={`${day.key} ${formatHourRange(hour)} - ${status ?? "no data"}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {days.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-3 text-xs">
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 text-center">
              <div className="font-semibold text-emerald-400">{stats.up}</div>
              <div className="text-muted-foreground">Up hours</div>
            </div>
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-center">
              <div className="font-semibold text-destructive">{stats.down}</div>
              <div className="text-muted-foreground">Down hours</div>
            </div>
            <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2 text-center">
              <div className="font-semibold">{stats.unknown}</div>
              <div className="text-muted-foreground">No data</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
