/**
 * Time-zone helpers. Every schedule is defined in the ELDER's local time zone
 * (profile.timezone, e.g. "Asia/Kolkata") and converted to UTC instants here.
 * No external dependencies: built on Intl.DateTimeFormat.
 */

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isLocalDate(value: string): boolean {
  return DATE_RE.test(value);
}

export function isLocalTime(value: string): boolean {
  return TIME_RE.test(value);
}

/** Wall-clock parts of an instant as seen in a time zone. */
function partsInZone(instant: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const get = (type: string) => Number(fmt.formatToParts(instant).find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Offset (ms) of the zone from UTC at a given instant. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const p = partsInZone(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Convert a local date ("2026-11-15") + local time ("08:00") in a zone to a UTC Date.
 * Handles DST by re-checking the offset at the candidate instant.
 */
export function zonedToUtc(localDate: string, localTime: string, timeZone: string): Date {
  if (!isLocalDate(localDate)) throw new Error(`Invalid local date: ${localDate}`);
  if (!isLocalTime(localTime)) throw new Error(`Invalid local time: ${localTime}`);
  const [y, m, d] = localDate.split("-").map(Number);
  const [hh, mm] = localTime.split(":").map(Number);
  const naiveUtc = Date.UTC(y, m - 1, d, hh, mm);
  const firstGuess = naiveUtc - zoneOffsetMs(new Date(naiveUtc), timeZone);
  const corrected = naiveUtc - zoneOffsetMs(new Date(firstGuess), timeZone);
  return new Date(corrected);
}

/** The local calendar date ("YYYY-MM-DD") of an instant in a zone. */
export function localDateOf(instant: Date, timeZone: string): string {
  const p = partsInZone(instant, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Day of week (0 = Sunday … 6 = Saturday) for a local date string. */
export function dayOfWeek(localDate: string): number {
  const [y, m, d] = localDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Add whole days to a local date string. */
export function addDays(localDate: string, days: number): string {
  const [y, m, d] = localDate.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

/** Human-friendly local time, e.g. "8:00 AM". */
export function formatLocalTime(instant: Date, timeZone: string, locale = "en-IN"): string {
  return new Intl.DateTimeFormat(locale, { timeZone, hour: "numeric", minute: "2-digit" }).format(instant);
}

/** Human-friendly local date, e.g. "Sat, 15 Nov". */
export function formatLocalDate(instant: Date, timeZone: string, locale = "en-IN"): string {
  return new Intl.DateTimeFormat(locale, { timeZone, weekday: "short", day: "numeric", month: "short" }).format(
    instant,
  );
}
