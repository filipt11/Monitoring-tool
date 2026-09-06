/** Converts raw availability (0–1) to a 0–100 percentage scale. Values already on 0–100 pass through. */
export function toAvailabilityPercentScale(value: number): number {
  if (!Number.isFinite(value)) {
    return value;
  }

  return value <= 1 ? value * 100 : value;
}

/** Formats chart axis/tooltip values on the 0–100 availability scale. */
export function formatAvailabilityChartValue(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return `${value.toFixed(decimals)}%`;
}

/** Formats raw API availability (0–1 fraction or 0/1 sample) for tables and summaries. */
export function formatAvailabilityPercent(value: number, decimals = 2): string {
  return formatAvailabilityChartValue(toAvailabilityPercentScale(value), decimals);
}
