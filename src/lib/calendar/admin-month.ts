import type { SupabaseClient } from "@supabase/supabase-js";

import { parseYm } from "@/lib/calendar/no-zero-month";
import { mapEventRow, type EventRow } from "@/lib/database/mappers";
import type { Event } from "@/lib/database/types";

/**
 * Org-wide month calendar for admins — every event in the visible month,
 * regardless of who created/hosts it (RLS's can_manage_event() already grants
 * admins full visibility, so this is a single flat query, no per-member joins).
 */

export type AdminDayCell = {
  /** "YYYY-MM-DD" */
  iso: string;
  day: number;
  isToday: boolean;
  events: Event[];
};

export type AdminMonth = {
  ym: string; // "YYYY-MM"
  monthLabel: string; // "June 2026"
  prevYm: string;
  nextYm: string;
  /** Number of blank cells before day 1 (Sunday-first grid). */
  leadingBlanks: number;
  cells: AdminDayCell[];
  /** Flat, chronologically sorted — same rows as `cells`, for the agenda list. */
  events: Event[];
};

const pad = (n: number) => String(n).padStart(2, "0");

export async function buildAdminMonth(
  supabase: SupabaseClient,
  ym?: string | null,
): Promise<AdminMonth> {
  const { year, monthIndex } = parseYm(ym);

  const monthStart = new Date(Date.UTC(year, monthIndex, 1));
  const monthEnd = new Date(Date.UTC(year, monthIndex + 1, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const leadingBlanks = monthStart.getUTCDay();

  const ymStr = `${year}-${pad(monthIndex + 1)}`;
  const prev = new Date(Date.UTC(year, monthIndex - 1, 1));
  const next = new Date(Date.UTC(year, monthIndex + 1, 1));
  const prevYm = `${prev.getUTCFullYear()}-${pad(prev.getUTCMonth() + 1)}`;
  const nextYm = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}`;
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(monthStart);

  const todayIso = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("events")
    .select("*")
    .gte("starts_at", monthStart.toISOString())
    .lt("starts_at", monthEnd.toISOString())
    .order("starts_at")
    .returns<EventRow[]>();

  const events = (data ?? []).map(mapEventRow);

  const eventsByDay = new Map<string, Event[]>();
  for (const ev of events) {
    const key = ev.startsAt.slice(0, 10);
    const list = eventsByDay.get(key) ?? [];
    list.push(ev);
    eventsByDay.set(key, list);
  }

  const cells: AdminDayCell[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${ymStr}-${pad(day)}`;
    cells.push({
      iso,
      day,
      isToday: iso === todayIso,
      events: eventsByDay.get(iso) ?? [],
    });
  }

  return { ym: ymStr, monthLabel, prevYm, nextYm, leadingBlanks, cells, events };
}
