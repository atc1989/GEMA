/**
 * Arrival slots for scheduled events (medical / check-up landings).
 *
 * A slot IS the arrival window — "arrive 9:00–9:10", not "appointment at 9:00".
 * The guest is seen in queue order once they are in the room, which is what
 * survives a clinic running ten minutes behind by mid-morning.
 *
 * `seatsTotal` is the number of doctor+nurse teams working that window. v1
 * ships one team, so a slot holds one guest, but nothing here assumes that.
 */

import { APP_TIMEZONE, formatLandingTime } from "@/lib/utils/format";

/**
 * v1 is fixed: ten minutes per window, one doctor+nurse team. The database
 * takes both as parameters, so widening this is a form change, not a migration.
 */
export const SLOT_MINUTES = 10;
export const TEAMS_PER_SLOT = 1;

/**
 * Lunch. Windows inside it are created closed, so a 9-5 clinic is 9-12 and 1-5.
 * Wall-clock in the event's own timezone, not UTC. An admin can reopen any of
 * them on the schedule page and regeneration will not shut them again.
 */
export const BREAK_START = "12:00";
export const BREAK_END = "13:00";

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

  return {
    eventId,
    timezone: str(row.timezone) || APP_TIMEZONE,
    slotMinutes: int(row.slot_minutes, 10),
    slots,
  };
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
 * "9:00–9:10 AM" — one meridiem when both ends share it, two when they don't
 * ("11:50 AM–12:00 PM").
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

/** Short label for a slot chip: "9:00–9:10". */
export function formatSlotChip(slot: EventSlot, timezone?: string): string {
  const tz = timezone || APP_TIMEZONE;
  const from = formatLandingTime(slot.startsAt, tz);
  const to = formatLandingTime(slot.endsAt, tz);
  return `${from.slice(0, -3)}–${to.slice(0, -3)}`;
}

export type SlotGroup<T extends EventSlot = EventSlot> = {
  key: string;
  label: string;
  slots: T[];
};

/**
 * Slots grouped by the hour they start in, so a four-hour clinic reads as four
 * short rows instead of twenty-four loose chips.
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
