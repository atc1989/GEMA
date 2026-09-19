import type { AttendanceDay } from "@/components/attendance/attendance-day-tabs";
import { formatDayLabel, zonedDayKey } from "@/lib/events/slots";

/** What the day index needs off a registration. */
export type DayScopedRegistration = {
  id: string;
  /** Start of the booked arrival window, or null on standby. */
  slotStartsAt: string | null;
  /** "YYYY-MM-DD" a standby guest joined the queue for, or null. */
  standbyDay: string | null;
  /** When the door actually scanned them, or null if they never turned up. */
  checkedInAt: string | null;
};

export type AttendanceDayIndex = {
  days: AttendanceDay[];
  /** Registration id → the day it counts against, or null if it has no day. */
  dayById: Map<string, string | null>;
  /** Registration id → the day they booked, when they were seen on another one. */
  bookedElsewhereById: Map<string, string>;
};

/**
 * Splits a multi-day run into days, by the day each guest was actually there.
 *
 * A Friday-Saturday clinic is kept as one event so its landing URL never
 * changes, so every day's registrations pile into one list and something has to
 * pull them back apart. The obvious axis is the arrival window somebody booked,
 * and for anyone who has not turned up yet that is the only axis there is.
 *
 * It is the wrong one once they have. People book Friday 4:40 and walk in on
 * Saturday afternoon, and grouping those by the window they booked puts a body
 * that was in the room on Saturday into Friday's headcount and Friday's
 * attendance rate. So: scanned guests count on the day they were scanned,
 * everybody else on the day they booked. A guest who moved keeps their booked
 * day as a label on the row, because the door still needs to see which window
 * they were meant to be in.
 */
export function indexAttendanceDays(
  regs: DayScopedRegistration[],
  timezone: string,
): AttendanceDayIndex {
  const dayById = new Map<string, string | null>();
  const bookedElsewhereById = new Map<string, string>();
  // One real timestamp per day for the label: rebuilding an instant from the
  // date key alone needs a zone offset and gets the label wrong either side of
  // UTC. Noon UTC is the fallback for a standby row, which carries a date and
  // no time — it lands on the same calendar day everywhere GEMA runs.
  const counts = new Map<string, { count: number; sample: string }>();

  for (const reg of regs) {
    const bookedKey = reg.slotStartsAt
      ? zonedDayKey(reg.slotStartsAt, timezone)
      : reg.standbyDay;
    const seenKey = reg.checkedInAt ? zonedDayKey(reg.checkedInAt, timezone) : null;
    const key = seenKey ?? bookedKey;

    dayById.set(reg.id, key);
    if (seenKey && bookedKey && bookedKey !== seenKey) {
      bookedElsewhereById.set(
        reg.id,
        formatDayLabel(reg.slotStartsAt ?? `${bookedKey}T12:00:00Z`, timezone),
      );
    }
    if (!key) continue;

    const sample = reg.checkedInAt ?? reg.slotStartsAt ?? `${key}T12:00:00Z`;
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { count: 1, sample });
  }

  const days: AttendanceDay[] = [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, { count, sample }]) => ({
      key,
      label: formatDayLabel(sample, timezone),
      count,
    }));

  return { days, dayById, bookedElsewhereById };
}
