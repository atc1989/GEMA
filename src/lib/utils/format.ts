/** Formats an ISO timestamp in the event's timezone (e.g. "Fri, Jun 20, 4:00 PM"). */
export function formatEventDateTime(iso: string, timezone?: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone || undefined,
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

/** Milliseconds `timeZone` is ahead of UTC at the given instant (e.g. Asia/Manila → +8h). */
function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wallClockAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return wallClockAsUtc - date.getTime();
}

/**
 * Converts a <input type="datetime-local"> value ("YYYY-MM-DDTHH:mm"), read as
 * wall-clock time in `timeZone`, to a UTC ISO string. Never uses the runtime's
 * own timezone, so the result is identical on server and client.
 */
export function zonedDateTimeToIso(local: string, timeZone: string): string {
  const normalized = local.length === 16 ? `${local}:00` : local;
  const pretendUtc = new Date(`${normalized}Z`);
  // Two passes so instants near a DST transition resolve to the right offset.
  const guess = pretendUtc.getTime() - tzOffsetMs(pretendUtc, timeZone);
  const offset = tzOffsetMs(new Date(guess), timeZone);
  return new Date(pretendUtc.getTime() - offset).toISOString();
}

/**
 * Converts an ISO timestamp to the value a <input type="datetime-local"> expects,
 * as wall-clock time in `timeZone` (falls back to the runtime's local time).
 */
export function toDateTimeLocalValue(
  iso: string | null | undefined,
  timeZone?: string,
): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (timeZone) {
    return new Date(d.getTime() + tzOffsetMs(d, timeZone)).toISOString().slice(0, 16);
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
