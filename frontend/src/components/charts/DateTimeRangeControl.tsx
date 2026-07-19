import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function toInputValue(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface DateTimeRangeControlProps {
  idPrefix: string;
  start: Date;
  end: Date;
  onApply: (start: Date, end: Date) => void;
  startLabel?: string;
  endLabel?: string;
  disabled?: boolean;
}

/** Start/end datetime-local inputs shared by the time series and heatmap charts. */
export function DateTimeRangeControl({
  idPrefix,
  start,
  end,
  onApply,
  startLabel = "Start",
  endLabel = "End",
  disabled = false,
}: DateTimeRangeControlProps) {
  const [startValue, setStartValue] = useState(() => toInputValue(start));
  const [endValue, setEndValue] = useState(() => toInputValue(end));

  const handleApply = useCallback(() => {
    const parsedStart = new Date(startValue);
    const parsedEnd = new Date(endValue);

    if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
      return;
    }

    onApply(parsedStart, parsedEnd);
  }, [startValue, endValue, onApply]);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-start`}>{startLabel}</Label>
        <Input
          id={`${idPrefix}-start`}
          type="datetime-local"
          value={startValue}
          onChange={(event) => setStartValue(event.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-end`}>{endLabel}</Label>
        <Input
          id={`${idPrefix}-end`}
          type="datetime-local"
          value={endValue}
          onChange={(event) => setEndValue(event.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="flex items-end">
        <Button onClick={handleApply} className="w-full" disabled={disabled}>
          Apply range
        </Button>
      </div>
    </div>
  );
}
