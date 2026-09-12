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
