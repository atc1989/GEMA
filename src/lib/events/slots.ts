/**
 * Arrival slots for scheduled events (medical / check-up landings).
 *
 * A slot IS the arrival window — "arrive 9:00–9:30", not "appointment at 9:00".
 * The guest is seen in queue order once they are in the room, which is what
 * survives a clinic running behind by mid-morning.
 *
 * `seatsTotal` is the number of doctor+nurse teams working that window. v1
 * ships one team, so a slot holds one guest, but nothing here assumes that.
 */

import { APP_TIMEZONE, formatLandingTime, zonedDateKey } from "@/lib/utils/format";

/**
 * The window length a new event starts with. The real value lives on the event
 * (`events.slot_minutes`) and the host picks it on the form; this is only the
 * default, and the fallback when a row predates the column.
 *
 * The arithmetic is worth knowing: at 30 minutes, a 9-5 day with an hour's
 * break is seven working hours, so 14 windows and — at one team — 14 seats.
 * There are no walk-ins, so that is the whole day.
 */
export const SLOT_MINUTES = 30;

/**
 * Teams working one window, one guest each. The default for a new event; the
 * real value lives on the event (`events.teams_per_slot`).
 */
export const TEAMS_PER_SLOT = 1;

/** What the form offers. The database allows 1-20. */
export const TEAM_CHOICES = [1, 2, 3, 4, 5, 6] as const;

/**
 * Below this many seats the page stops naming the number.
 *
 * An exact count is useful while it is comfortable and becomes a countdown
 * clock once it is small. What it must never do is claim seats that are gone —
 * at zero the page says fully booked and offers the standby list instead.
 */
export const SEATS_LOW_THRESHOLD = 5;

/** Standby list size a new event starts with; the real value is on the event. */
export const STANDBY_LIMIT = 80;

/** 0 = Sunday, matching Postgres `extract(dow)` and JS `getDay()`. */
export const WEEKDAYS: { value: number; short: string; label: string }[] = [
  { value: 1, short: "Mon", label: "Monday" },
  { value: 2, short: "Tue", label: "Tuesday" },
  { value: 3, short: "Wed", label: "Wednesday" },
  { value: 4, short: "Thu", label: "Thursday" },
  { value: 5, short: "Fri", label: "Friday" },
  { value: 6, short: "Sat", label: "Saturday" },
  { value: 0, short: "Sun", label: "Sunday" },
];

/** A run of days reads better as "Fri, Sat" than as a set of numbers. */
export function formatWeekdays(days: number[] | null | undefined): string {
  if (!days || days.length === 0) return "Every day";
  const picked = WEEKDAYS.filter((d) => days.includes(d.value));
  if (picked.length === 7) return "Every day";
  return picked.map((d) => d.short).join(", ");
}

/**
 * What the form offers. Every value divides an hour and satisfies the database's
 * "5-120, in steps of 5" check, so the picker cannot produce a grid the RPC
 * would reject.
 */
export const SLOT_MINUTE_CHOICES = [10, 15, 20, 30, 45, 60] as const;

/**
 * What the form offers for a new event. The break itself is stored per event
 * (`events.break_start` / `break_end`); these are only the defaults, and an
 * event with no break at all is valid — both fields blank.
 */
export const DEFAULT_BREAK_START = "12:00";
export const DEFAULT_BREAK_END = "13:00";

/** "12:00:00" from Postgres `time`, "12:00" for <input type="time">. */
export function toTimeInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{2}):(\d{2})/.exec(value.trim());
  return match ? `${match[1]}:${match[2]}` : "";
}

/** "9:00 AM" from a "HH:MM" wall-clock string, for hints and summaries. */
export function formatClockLabel(value: string | null | undefined): string {
  const hhmm = toTimeInputValue(value);
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const meridiem = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${meridiem}`;
}

export type EventSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  seatsTotal: number;
  seatsTaken: number;
  closed: boolean;
};

export type EventScheduling = {
  eventId: string;
  /** Event timezone. Slots are always rendered here, never in the browser's. */
  timezone: string;
  slotMinutes: number;
  slots: EventSlot[];
  /** A full day offers the queue instead of turning people away. */
  standbyEnabled: boolean;
  standbyLimit: number;
  /**
   * Waiting per day, keyed "YYYY-MM-DD" — or "all" on a single-day event.
   * Counts only: the public payload never carries a name.
   */
  standbyCounts: Record<string, number>;
};

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function int(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

/** Parses the get_event_slots payload. Returns null when scheduling is off. */
export function parseEventScheduling(raw: unknown): EventScheduling | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const eventId = str(row.event_id);
  if (!eventId) return null;

  const rawSlots = Array.isArray(row.slots) ? row.slots : [];
  const slots = rawSlots.flatMap((item): EventSlot[] => {
    if (!item || typeof item !== "object") return [];
    const slot = item as Record<string, unknown>;
    const id = str(slot.id);
    const startsAt = str(slot.starts_at);
    const endsAt = str(slot.ends_at);
    if (!id || !startsAt || !endsAt) return [];
    return [
      {
        id,
        startsAt,
        endsAt,
        seatsTotal: int(slot.seats_total, 1),
        seatsTaken: int(slot.seats_taken, 0),
        closed: slot.closed === true,
      },
    ];
  });

  slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const rawCounts =
    row.standby_counts && typeof row.standby_counts === "object"
      ? (row.standby_counts as Record<string, unknown>)
      : {};
  const standbyCounts: Record<string, number> = {};
  for (const [key, value] of Object.entries(rawCounts)) {
    standbyCounts[key] = int(value, 0);
  }

  return {
    eventId,
    timezone: str(row.timezone) || APP_TIMEZONE,
    slotMinutes: int(row.slot_minutes, SLOT_MINUTES),
    slots,
    standbyEnabled: row.standby_enabled === true,
    standbyLimit: int(row.standby_limit, STANDBY_LIMIT),
    standbyCounts,
  };
}

/** Waiting on a given day — "all" on a single-day event. */
export function standbyWaiting(
  scheduling: EventScheduling,
  dayKey?: string | null,
): number {
  return scheduling.standbyCounts[dayKey || "all"] ?? 0;
}

/** The queue itself can fill up. 80 people for 28 chairs is already generous. */
export function standbyIsFull(
  scheduling: EventScheduling,
  dayKey?: string | null,
): boolean {
  return standbyWaiting(scheduling, dayKey) >= scheduling.standbyLimit;
}

/**
 * What the page says about seats.
 *
 * Exact while the number is comfortable, vague when it is short, and honest
 * when it is gone — a page that says "a few seats left" to somebody who then
 * travels an hour to be turned away has cost more than the registration.
 */
export function seatsLabel(scheduling: EventScheduling | null, seatsFree: number): string {
  if (seatsFree > SEATS_LOW_THRESHOLD) return `Free · ${seatsFree} seats left`;
  if (seatsFree > 0) return "Free · only a few seats left";
  if (scheduling?.standbyEnabled && !standbyIsFull(scheduling)) {
    return "Fully booked · standby open";
  }
  return "Fully booked";
}

export function slotSeatsLeft(slot: EventSlot): number {
  return Math.max(slot.seatsTotal - slot.seatsTaken, 0);
}

/** Bookable: not closed, not full, and the window has not passed. */
export function slotIsOpen(slot: EventSlot, now: number = Date.now()): boolean {
  if (slot.closed) return false;
  if (slotSeatsLeft(slot) < 1) return false;
  const ends = new Date(slot.endsAt).getTime();
  return Number.isFinite(ends) ? ends > now : true;
}

export function openSlots(scheduling: EventScheduling, now?: number): EventSlot[] {
  return scheduling.slots.filter((slot) => slotIsOpen(slot, now));
}

/**
 * Seats free, ignoring the clock. The time-aware `slotIsOpen` is for the
 * picker, which only ever runs after mount; a landing page renders on the
 * server first, and "is 9:00 in the past" answered twice a second apart is a
 * hydration mismatch waiting to happen.
 */
export function slotHasSeats(slot: EventSlot): boolean {
  return !slot.closed && slotSeatsLeft(slot) > 0;
}

/** Sold out, clock-independent — safe to render on the server. */
export function isSoldOut(scheduling: EventScheduling): boolean {
  return !scheduling.slots.some(slotHasSeats);
}

/** First window with a seat, clock-independent. */
export function nextSlotWithSeats(scheduling: EventScheduling): EventSlot | null {
  return scheduling.slots.find(slotHasSeats) ?? null;
}

/** No walk-ins, so this is the whole story: nothing left to book. */
export function isFullyBooked(scheduling: EventScheduling, now?: number): boolean {
  return openSlots(scheduling, now).length === 0;
}

export function seatsLeftTotal(scheduling: EventScheduling, now?: number): number {
  return openSlots(scheduling, now).reduce((sum, slot) => sum + slotSeatsLeft(slot), 0);
}

export function nextOpenSlot(scheduling: EventScheduling, now?: number): EventSlot | null {
  return openSlots(scheduling, now)[0] ?? null;
}

export function findSlot(scheduling: EventScheduling, slotId: string | null): EventSlot | null {
  if (!slotId) return null;
  return scheduling.slots.find((slot) => slot.id === slotId) ?? null;
}

/**
 * "9:00–9:30 AM" — one meridiem when both ends share it, two when they don't
 * ("11:30 AM–12:00 PM").
 */
export function formatWindowRange(
  startsAt: string,
  endsAt: string,
  timezone?: string,
): string {
  const tz = timezone || APP_TIMEZONE;
  const from = formatLandingTime(startsAt, tz);
  const to = formatLandingTime(endsAt, tz);
  const meridiem = (value: string) => value.slice(-2);
  if (meridiem(from) === meridiem(to)) {
    return `${from.slice(0, -3)}–${to}`;
  }
  return `${from}–${to}`;
}

export function formatArrivalWindow(slot: EventSlot, timezone?: string): string {
  return formatWindowRange(slot.startsAt, slot.endsAt, timezone);
}

/** Short label for a slot chip: "9:00–9:30". */
export function formatSlotChip(slot: EventSlot, timezone?: string): string {
  const tz = timezone || APP_TIMEZONE;
  const from = formatLandingTime(slot.startsAt, tz);
  const to = formatLandingTime(slot.endsAt, tz);
  return `${from.slice(0, -3)}–${to.slice(0, -3)}`;
}

/**
 * Calendar day a window falls on, in the event's timezone — "2026-09-11".
 *
 * This is the axis a repeating clinic needs everywhere: which day someone is
 * coming. It is NOT the day they registered, which is what a naive date filter
 * on the attendance list would have given.
 */
export function zonedDayKey(iso: string, timezone?: string): string {
  return zonedDateKey(iso, timezone || APP_TIMEZONE);
}

export function slotDayKey(slot: EventSlot, timezone?: string): string {
  return zonedDayKey(slot.startsAt, timezone);
}

/** "Fri, 11 Sep" — the label above a day's windows. */
export function formatDayLabel(iso: string, timezone?: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone || APP_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("weekday")}, ${get("day")} ${get("month")}`;
}

export type SlotDay<T extends EventSlot = EventSlot> = {
  /** "2026-09-11" in the event's timezone. */
  key: string;
  label: string;
  slots: T[];
};

/** Windows split by the day they fall on, earliest first. */
export function groupSlotsByDay<T extends EventSlot>(
  slots: T[],
  timezone?: string,
): SlotDay<T>[] {
  const days = new Map<string, SlotDay<T>>();
  for (const slot of slots) {
    const key = slotDayKey(slot, timezone);
    const existing = days.get(key);
    if (existing) {
      existing.slots.push(slot);
    } else {
      days.set(key, {
        key,
        label: formatDayLabel(slot.startsAt, timezone),
        slots: [slot],
      });
    }
  }
  return [...days.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export type SlotGroup<T extends EventSlot = EventSlot> = {
  key: string;
  label: string;
  slots: T[];
};

/**
 * Slots grouped by the hour they start in, so a whole clinic day reads as a
 * handful of short rows instead of one long run of chips.
 *
 * Generic so the admin schedule can group its own richer rows (each carrying
 * the guests booked into it) without casting them back down.
 */
export function groupSlotsByHour<T extends EventSlot>(
  slots: T[],
  timezone?: string,
): SlotGroup<T>[] {
  const tz = timezone || APP_TIMEZONE;
  const groups = new Map<string, SlotGroup<T>>();
  for (const slot of slots) {
    const label = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      timeZone: tz,
    }).format(new Date(slot.startsAt));
    const existing = groups.get(label);
    if (existing) {
      existing.slots.push(slot);
    } else {
      groups.set(label, { key: label, label, slots: [slot] });
    }
  }
  return [...groups.values()];
}
