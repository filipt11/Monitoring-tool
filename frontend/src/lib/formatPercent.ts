export const LOW_PERCENT_THRESHOLD = 0.01;

export interface FormatPercentOptions {
  decimals?: number;
  /** When false, returns only the numeric/threshold portion without a trailing "%". */
  includeUnit?: boolean;
  threshold?: number;
}

/**
 * Formats percentage values. Values above zero but below the threshold
 * (default 0.01%) are shown as "<0.01%" — similar to CA PM.
 */
export function formatPercentValue(
  value: number,
  options: FormatPercentOptions = {},
): string {
  const decimals = options.decimals ?? 2;
  const threshold = options.threshold ?? LOW_PERCENT_THRESHOLD;
  const includeUnit = options.includeUnit ?? true;
  const unitSuffix = includeUnit ? "%" : "";

  if (!Number.isFinite(value)) {
    return "—";
  }

  if (value === 0) {
    return `${(0).toFixed(decimals)}${unitSuffix}`;
  }

  if (value > 0 && value < threshold) {
    return `<${threshold.toFixed(decimals)}${unitSuffix}`;
  }

  return `${value.toFixed(decimals)}${unitSuffix}`;
}
