/**
 * Formats a duration given in minutes into a human-readable string.
 * Uses server-returned duration_minutes only — never recalculates from times.
 *
 * Examples:
 *   450 → "7h 30m"
 *   480 → "8h"
 *    60 → "1h"
 *    45 → "45m"
 */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Formats an average duration given in minutes into a human-readable string.
 * Presentation-only rounding: rounds fractional minutes to the nearest whole minute.
 * Returns '—' when minutes is null (empty window).
 *
 * Examples:
 *   null   → "—"
 *   450.5  → "7h 31m"
 *   450    → "7h 30m"
 *   480    → "8h"
 *   45     → "45m"
 */
export function formatAverageDuration(minutes: number | null): string {
  if (minutes === null) return '—';
  const rounded = Math.round(minutes);
  return formatDuration(rounded);
}

/**
 * Formats an average sleep quality score (1-10) for presentation.
 * Rounds to at most one decimal place, avoiding unnecessary trailing ".0".
 * Returns '—' when quality is null (empty window).
 *
 * Examples:
 *   null  → "—"
 *   8     → "8 / 10"
 *   8.0   → "8 / 10"
 *   8.2   → "8.2 / 10"
 *   8.24  → "8.2 / 10"
 *   8.26  → "8.3 / 10"
 *   7.95  → "8 / 10"
 */
export function formatAverageQuality(quality: number | null): string {
  if (quality === null) return '—';
  const rounded = Math.round(quality * 10) / 10;
  const formatted = rounded.toFixed(1);
  const clean = formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
  return `${clean} / 10`;
}

/**
 * Formats record count with proper singular/plural grammar.
 *
 * Examples:
 *   0 → "0 nights"
 *   1 → "1 night"
 *   6 → "6 nights"
 */
export function formatRecordCount(count: number): string {
  return `${count} night${count === 1 ? '' : 's'}`;
}
