import { useCallback, useEffect, useState } from "react";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Label } from "@/components/ui/label";
import type { TimeRangeApplyMeta } from "@/lib/timeRangePresets";

interface DateTimeRangeControlProps {
  idPrefix: string;
  start: Date;
  end: Date;
  onApply: (start: Date, end: Date, meta?: TimeRangeApplyMeta) => void;
  startLabel?: string;
  endLabel?: string;
  disabled?: boolean;
}

/** Start/end datetime pickers shared by the time series and heatmap charts. */
export function DateTimeRangeControl({
  idPrefix,
  start,
  end,
  onApply,
  startLabel = "Start",
  endLabel = "End",
  disabled = false,
}: DateTimeRangeControlProps) {
  const [startValue, setStartValue] = useState(() => new Date(start));
  const [endValue, setEndValue] = useState(() => new Date(end));

  useEffect(() => {
    setStartValue(new Date(start));
    setEndValue(new Date(end));
  }, [start, end]);

  const handleApply = useCallback(() => {
    if (startValue.getTime() >= endValue.getTime()) {
      return;
    }

    onApply(startValue, endValue);
  }, [startValue, endValue, onApply]);

  const handleRefresh = useCallback(() => {
    if (startValue.getTime() >= endValue.getTime()) {
      return;
    }

    onApply(startValue, endValue, { refreshToken: Date.now() });
  }, [startValue, endValue, onApply]);

  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto_auto]">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-start`}>{startLabel}</Label>
        <DateTimePicker
          id={`${idPrefix}-start`}
          value={startValue}
          onChange={setStartValue}
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-end`}>{endLabel}</Label>
        <DateTimePicker
          id={`${idPrefix}-end`}
          value={endValue}
          onChange={setEndValue}
          disabled={disabled}
        />
      </div>
      <div className="flex items-end">
        <Button onClick={handleApply} className="w-full" disabled={disabled}>
          Apply range
        </Button>
      </div>
      <div className="flex items-end">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9"
          disabled={disabled}
          onClick={handleRefresh}
          aria-label="Refresh"
          title="Refresh"
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>
    </div>
  );
}
