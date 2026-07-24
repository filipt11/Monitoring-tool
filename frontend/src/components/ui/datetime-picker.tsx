import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DateTimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function TimeColumn({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const selected = selectedRef.current;
    if (!container || !selected) {
      return;
    }

    const top =
      selected.offsetTop -
      container.clientHeight / 2 +
      selected.clientHeight / 2;
    container.scrollTop = Math.max(0, top);
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="flex max-h-[280px] flex-col overflow-y-auto py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {Array.from({ length: max + 1 }, (_, index) => (
        <button
          key={index}
          ref={value === index ? selectedRef : undefined}
          type="button"
          onClick={() => onChange(index)}
          className={cn(
            "min-w-12 rounded-md px-3 py-1.5 text-sm tabular-nums transition-colors",
            value === index
              ? "bg-primary text-primary-foreground"
              : "text-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          {index.toString().padStart(2, "0")}
        </button>
      ))}
    </div>
  );
}

export function DateTimePicker({
  value,
  onChange,
  disabled = false,
  id,
  className,
  open: openProp,
  onOpenChange,
}: DateTimePickerProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(next);
    }
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (disabled && open) {
      setOpen(false);
    }
  }, [disabled, open]);

  const updateDatePart = (date: Date | undefined) => {
    if (!date) {
      return;
    }

    const next = new Date(value);
    next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    onChange(next);
  };

  const updateHour = (hour: number) => {
    const next = new Date(value);
    next.setHours(hour);
    onChange(next);
  };

  const updateMinute = (minute: number) => {
    const next = new Date(value);
    next.setMinutes(minute);
    onChange(next);
  };

  const setToday = () => {
    const now = new Date();
    const next = new Date(value);
    next.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
    onChange(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "border-input dark:bg-input/30 dark:hover:bg-input/50 h-9 w-full justify-between px-3 text-left text-sm font-normal shadow-xs",
            className,
          )}
        >
          <span>{format(value, "dd.MM.yyyy HH:mm")}</span>
          <CalendarIcon className="text-muted-foreground size-4 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="start"
        side="bottom"
        sideOffset={4}
        avoidCollisions={false}
        sticky="partial"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <div className="flex">
          <div className="relative shrink-0">
            <Calendar
              mode="single"
              selected={value}
              onSelect={updateDatePart}
              defaultMonth={value}
            />
            <div className="flex items-center justify-end border-t border-border px-3 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-primary h-8 px-2 text-xs"
                onClick={setToday}
              >
                Today
              </Button>
            </div>
          </div>
          <div className="relative z-0 flex shrink-0 border-l border-border">
            <TimeColumn value={value.getHours()} max={23} onChange={updateHour} />
            <TimeColumn
              value={value.getMinutes()}
              max={59}
              onChange={updateMinute}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
