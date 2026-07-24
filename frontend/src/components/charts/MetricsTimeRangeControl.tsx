import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { CalendarRange, Clock3, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Label } from "@/components/ui/label";
import {
  detectPresetFromRange,
  formatRangeSummary,
  getPresetRange,
  refreshMetricsRange,
  TIME_RANGE_PRESETS,
  type TimeRangeApplyMeta,
  type TimeRangePresetId,
} from "@/lib/timeRangePresets";
import { formatMetricsAggregationLabel } from "@/lib/metricsAggregation";
import { cn } from "@/lib/utils";

interface MetricsTimeRangeControlProps {
  idPrefix: string;
  start: Date;
  end: Date;
  onApply: (start: Date, end: Date, meta?: TimeRangeApplyMeta) => void;
  disabled?: boolean;
  /** When true, shows a spinning refresh icon and "Refreshing…" label. */
  isRefreshing?: boolean;
}

export function MetricsTimeRangeControl({
  idPrefix,
  start,
  end,
  onApply,
  disabled = false,
  isRefreshing = false,
}: MetricsTimeRangeControlProps) {
  const [activePreset, setActivePreset] = useState<TimeRangePresetId>(() =>
    detectPresetFromRange({ start, end }),
  );
  const [customStartValue, setCustomStartValue] = useState(() => new Date(start));
  const [customEndValue, setCustomEndValue] = useState(() => new Date(end));
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);
  const [pendingLoading, setPendingLoading] = useState(false);
  const prevDisabledRef = useRef(disabled);
  const keepCustomPresetRef = useRef(false);
  const showLoading = pendingLoading || isRefreshing;

  useEffect(() => {
    setCustomStartValue(new Date(start));
    setCustomEndValue(new Date(end));

    if (keepCustomPresetRef.current) {
      keepCustomPresetRef.current = false;
      setActivePreset("custom");
      return;
    }

    setActivePreset(detectPresetFromRange({ start, end }));
  }, [start, end]);

  useEffect(() => {
    if (!isRefreshing) {
      setPendingLoading(false);
    }
  }, [isRefreshing]);

  useEffect(() => {
    if (pendingLoading && prevDisabledRef.current && !disabled) {
      setPendingLoading(false);
    }

    prevDisabledRef.current = disabled;
  }, [disabled, pendingLoading]);

  const beginLoading = useCallback(() => {
    setPendingLoading(true);
  }, []);

  const applyRange = useCallback(
    (nextStart: Date, nextEnd: Date, meta?: TimeRangeApplyMeta) => {
      beginLoading();
      startTransition(() => {
        onApply(nextStart, nextEnd, meta);
      });
    },
    [beginLoading, onApply],
  );

  const rangeSummary = useMemo(() => formatRangeSummary(start, end), [start, end]);
  const aggregationSummary = useMemo(
    () => formatMetricsAggregationLabel(start, end),
    [start, end],
  );

  const handlePresetSelect = useCallback(
    (presetId: TimeRangePresetId) => {
      if (presetId === "custom") {
        setActivePreset("custom");
        return;
      }

      const range = getPresetRange(presetId);
      if (!range) {
        return;
      }

      setActivePreset(presetId);
      applyRange(range.start, range.end);
    },
    [applyRange],
  );

  const handleCustomApply = useCallback(() => {
    if (customStartValue.getTime() >= customEndValue.getTime()) {
      return;
    }

    flushSync(() => {
      setStartPickerOpen(false);
      setEndPickerOpen(false);
    });

    keepCustomPresetRef.current = true;
    setActivePreset("custom");
    applyRange(customStartValue, customEndValue);
  }, [applyRange, customStartValue, customEndValue]);

  const handleStartPickerOpenChange = useCallback(
    (open: boolean) => {
      if (open && showLoading) {
        return;
      }
      setStartPickerOpen(open);
    },
    [showLoading],
  );

  const handleEndPickerOpenChange = useCallback(
    (open: boolean) => {
      if (open && showLoading) {
        return;
      }
      setEndPickerOpen(open);
    },
    [showLoading],
  );

  const handleRefresh = useCallback(() => {
    const refreshed = refreshMetricsRange({ start, end }, activePreset);

    if (refreshed.refreshToken != null) {
      applyRange(refreshed.start, refreshed.end, { refreshToken: refreshed.refreshToken });
      return;
    }

    applyRange(refreshed.start, refreshed.end);
  }, [activePreset, applyRange, end, start]);

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-muted/15 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-muted-foreground mr-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
          <Clock3 className="size-3.5" />
          Time range
        </div>

        <div className="flex flex-wrap gap-1.5">
          {TIME_RANGE_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              size="sm"
              variant={activePreset === preset.id ? "default" : "outline"}
              className={cn(
                "h-8 rounded-full px-3 text-xs",
                activePreset !== preset.id && "bg-background/60",
              )}
              disabled={disabled || showLoading}
              onClick={() => handlePresetSelect(preset.id)}
            >
              {preset.label}
            </Button>
          ))}

          <Button
            type="button"
            size="sm"
            variant={activePreset === "custom" ? "default" : "outline"}
            className={cn(
              "h-8 rounded-full px-3 text-xs",
              activePreset !== "custom" && "bg-background/60",
            )}
            disabled={disabled || showLoading}
            onClick={() => handlePresetSelect("custom")}
          >
            Custom
          </Button>

          <Button
            type="button"
            size="icon"
            variant="outline"
            className={cn(
              "bg-background/60 size-8 rounded-full",
              showLoading && "border-primary/40 bg-primary/5",
            )}
            disabled={disabled || showLoading}
            onClick={handleRefresh}
            aria-busy={showLoading}
            aria-label={showLoading ? "Loading metrics" : "Refresh"}
            title={showLoading ? "Loading…" : "Refresh"}
          >
            <RefreshCw className={cn("size-3.5", showLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="text-muted-foreground flex flex-wrap items-start gap-x-2 gap-y-1 text-xs">
        <CalendarRange className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Showing{" "}
          <span className="text-foreground font-medium">{rangeSummary}</span>
          {" · "}
          <span className="text-foreground font-medium">{aggregationSummary}</span> resolution
        </span>
        {showLoading ? (
          <span className="text-primary inline-flex items-center gap-1 font-medium">
            <RefreshCw className="size-3 animate-spin" />
            Loading…
          </span>
        ) : null}
      </div>

      {activePreset === "custom" && (
        <div className="grid gap-3 rounded-lg border border-border/50 bg-background/40 p-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-custom-start`} className="text-xs">
              From
            </Label>
            <DateTimePicker
              id={`${idPrefix}-custom-start`}
              value={customStartValue}
              onChange={setCustomStartValue}
              disabled={disabled}
              open={showLoading ? false : startPickerOpen}
              onOpenChange={handleStartPickerOpenChange}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-custom-end`} className="text-xs">
              To
            </Label>
            <DateTimePicker
              id={`${idPrefix}-custom-end`}
              value={customEndValue}
              onChange={setCustomEndValue}
              disabled={disabled}
              open={showLoading ? false : endPickerOpen}
              onOpenChange={handleEndPickerOpenChange}
            />
          </div>

          <div className="flex items-end">
            <Button
              type="button"
              className="h-9 w-full sm:w-auto"
              disabled={disabled || showLoading}
              onClick={handleCustomApply}
            >
              Apply custom range
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
