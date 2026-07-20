import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Label } from "@/components/ui/label";
import {
  detectPresetFromRange,
  formatRangeSummary,
  getPresetRange,
  TIME_RANGE_PRESETS,
  type TimeRangePresetId,
} from "@/lib/timeRangePresets";
import { cn } from "@/lib/utils";

interface MetricsTimeRangeControlProps {
  idPrefix: string;
  start: Date;
  end: Date;
  onApply: (start: Date, end: Date) => void;
  disabled?: boolean;
}

export function MetricsTimeRangeControl({
  idPrefix,
  start,
  end,
  onApply,
  disabled = false,
}: MetricsTimeRangeControlProps) {
  const [activePreset, setActivePreset] = useState<TimeRangePresetId>(() =>
    detectPresetFromRange({ start, end }),
  );
  const [customStartValue, setCustomStartValue] = useState(() => new Date(start));
  const [customEndValue, setCustomEndValue] = useState(() => new Date(end));

  useEffect(() => {
    setActivePreset(detectPresetFromRange({ start, end }));
    setCustomStartValue(new Date(start));
    setCustomEndValue(new Date(end));
  }, [start, end]);

  const rangeSummary = useMemo(() => formatRangeSummary(start, end), [start, end]);

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
      onApply(range.start, range.end);
    },
    [onApply],
  );

  const handleCustomApply = useCallback(() => {
    if (customStartValue.getTime() >= customEndValue.getTime()) {
      return;
    }

    setActivePreset("custom");
    onApply(customStartValue, customEndValue);
  }, [customStartValue, customEndValue, onApply]);

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
              disabled={disabled}
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
            disabled={disabled}
            onClick={() => handlePresetSelect("custom")}
          >
            Custom
          </Button>
        </div>
      </div>

      <div className="text-muted-foreground flex items-start gap-2 text-xs">
        <CalendarRange className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Showing{" "}
          <span className="text-foreground font-medium">{rangeSummary}</span>
        </span>
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
            />
          </div>

          <div className="flex items-end">
            <Button
              type="button"
              className="h-9 w-full sm:w-auto"
              disabled={disabled}
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
