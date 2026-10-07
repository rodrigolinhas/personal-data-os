/**
 * Date and time display formatting utilities.
 *
 * All functions accept raw API values and format them for human-readable display.
 * API/ISO formats are preserved internally — these utilities are purely presentational.
 */

const DISPLAY_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * Formats an ISO date string (YYYY-MM-DD) for display.
 *
 * Examples:
 *   '2026-08-24' → '24 Aug 2026'
 *   '2026-01-01' → '1 Jan 2026'
 */
export function formatDisplayDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;

  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return isoDate;
  }

  return DISPLAY_DATE.format(date);
}

/**
 * Normalizes a time string from HH:MM:SS to HH:MM.
 * Returns the original string if already in HH:MM format.
 */
function normalizeTime(time: string): string {
  return time.length > 5 ? time.slice(0, 5) : time;
}

/**
 * Formats bedtime and wake time into a human-readable range.
 *
 * Examples:
 *   ('23:30', '07:00')       → '23:30 → 07:00'
 *   ('23:30:00', '07:00:00') → '23:30 → 07:00'
 */
export function formatTimeRange(bedtime: string, wakeTime: string): string {
  return `${normalizeTime(bedtime)} → ${normalizeTime(wakeTime)}`;
}
