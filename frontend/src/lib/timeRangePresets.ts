import { formatAppDate, formatAppDateTime, formatAppTime } from "@/lib/dateFormat";

export type TimeRangePresetId =
  | "last-1h"
  | "last-3h"
  | "last-24h"
  | "last-7-days"
  | "current-day"
  | "current-week"
  | "current-month"
  | "previous-day"
  | "previous-week"
  | "previous-month"
  | "custom";

export interface DateRange {
  start: Date;
  end: Date;
  /** Bumped on manual refresh so consumers can refetch without changing start/end. */
  refreshToken?: number;
}

export interface TimeRangeApplyMeta {
  refreshToken?: number;
}

export interface TimeRangePreset {
  id: TimeRangePresetId;
  label: string;
  getRange: (now?: Date) => DateRange;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function rollingRange(durationMs: number, now = new Date()): DateRange {
  return {
    start: new Date(now.getTime() - durationMs),
    end: now,
  };
}

function previousDayRange(now = new Date()): DateRange {
  const day = new Date(now);
  day.setDate(day.getDate() - 1);
  return {
    start: startOfDay(day),
    end: endOfDay(day),
  };
}

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = startOfDay(new Date(date));
  monday.setDate(date.getDate() + mondayOffset);
  return monday;
}

function currentDayRange(now = new Date()): DateRange {
  return {
    start: startOfDay(now),
    end: now,
  };
}

function currentWeekRange(now = new Date()): DateRange {
  return {
    start: startOfWeek(now),
    end: now,
  };
}

function currentMonthRange(now = new Date()): DateRange {
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
    end: now,
  };
}

function previousWeekRange(now = new Date()): DateRange {
  const thisMonday = startOfWeek(now);

  const start = new Date(thisMonday);
  start.setDate(start.getDate() - 7);

  const end = new Date(thisMonday);
  end.setMilliseconds(-1);

  return { start, end };
}

function previousMonthRange(now = new Date()): DateRange {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return { start, end };
}

export const TIME_RANGE_PRESETS: TimeRangePreset[] = [
  {
    id: "last-1h",
    label: "Last 1h",
    getRange: (now) => rollingRange(60 * 60 * 1000, now),
  },
  {
    id: "last-3h",
    label: "Last 3h",
    getRange: (now) => rollingRange(3 * 60 * 60 * 1000, now),
  },
  {
    id: "last-24h",
    label: "Last 24h",
    getRange: (now) => rollingRange(24 * 60 * 60 * 1000, now),
  },
  {
    id: "last-7-days",
    label: "Last 7 days",
    getRange: (now) => rollingRange(7 * 24 * 60 * 60 * 1000, now),
  },
  {
    id: "current-day",
    label: "Current day",
    getRange: currentDayRange,
  },
  {
    id: "current-week",
    label: "Current week",
    getRange: currentWeekRange,
  },
  {
    id: "current-month",
    label: "Current month",
    getRange: currentMonthRange,
  },
  {
    id: "previous-day",
    label: "Previous day",
    getRange: previousDayRange,
  },
  {
    id: "previous-week",
    label: "Previous week",
    getRange: previousWeekRange,
  },
  {
    id: "previous-month",
    label: "Previous month",
    getRange: previousMonthRange,
  },
];

export const DEFAULT_TIME_RANGE_PRESET: TimeRangePresetId = "last-24h";

export function getPresetRange(
  presetId: TimeRangePresetId,
  now = new Date(),
): DateRange | null {
  if (presetId === "custom") {
    return null;
  }

  const preset = TIME_RANGE_PRESETS.find((entry) => entry.id === presetId);
  return preset?.getRange(now) ?? null;
}

export function createDefaultMetricsRange(now = new Date()): DateRange {
  return getPresetRange(DEFAULT_TIME_RANGE_PRESET, now) ?? rollingRange(24 * 60 * 60 * 1000, now);
}

export function formatRangeSummary(start: Date, end: Date): string {
  const sameDay = start.toDateString() === end.toDateString();
  const dateOptions: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
  };

  if (sameDay) {
    return `${formatAppDate(start, dateOptions)}, ${formatAppTime(start, timeOptions)} – ${formatAppTime(end, timeOptions)}`;
  }

  return `${formatAppDateTime(start, { ...dateOptions, ...timeOptions })} – ${formatAppDateTime(end, { ...dateOptions, ...timeOptions })}`;
}

function rangesMatch(left: DateRange, right: DateRange, toleranceMs = 60_000): boolean {
  return (
    Math.abs(left.start.getTime() - right.start.getTime()) <= toleranceMs &&
    Math.abs(left.end.getTime() - right.end.getTime()) <= toleranceMs
  );
}

function isRollingPreset(presetId: TimeRangePresetId): boolean {
  return (
    presetId === "last-1h" ||
    presetId === "last-3h" ||
    presetId === "last-24h" ||
    presetId === "last-7-days"
  );
}

function isCurrentPeriodPreset(presetId: TimeRangePresetId): boolean {
  return (
    presetId === "current-day" || presetId === "current-week" || presetId === "current-month"
  );
}

export function refreshMetricsRange(
  range: DateRange,
  presetId: TimeRangePresetId,
  now = new Date(),
): DateRange {
  if (presetId !== "custom") {
    const presetRange = getPresetRange(presetId, now);
    if (presetRange) {
      return presetRange;
    }
  }

  return {
    start: new Date(range.start),
    end: new Date(range.end),
    refreshToken: now.getTime(),
  };
}

export function detectPresetFromRange(range: DateRange, now = new Date()): TimeRangePresetId {
  const durationMs = range.end.getTime() - range.start.getTime();
  const endNearNow = Math.abs(range.end.getTime() - now.getTime()) <= 5 * 60 * 1000;

  for (const preset of TIME_RANGE_PRESETS) {
    if (isRollingPreset(preset.id)) {
      const candidate = preset.getRange(now);
      const expectedDuration = candidate.end.getTime() - candidate.start.getTime();

      if (
        endNearNow &&
        Math.abs(durationMs - expectedDuration) <= 60_000
      ) {
        return preset.id;
      }
      continue;
    }

    if (isCurrentPeriodPreset(preset.id)) {
      const candidate = preset.getRange(now);

      if (
        endNearNow &&
        Math.abs(range.start.getTime() - candidate.start.getTime()) <= 60_000
      ) {
        return preset.id;
      }
      continue;
    }

    const candidate = preset.getRange(now);
    if (rangesMatch(range, candidate)) {
      return preset.id;
    }
  }

  return "custom";
}
