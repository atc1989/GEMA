import type { SupabaseClient } from "@supabase/supabase-js";

import type { EventMode, EventType } from "@/lib/database/types";

/**
 * Builds the data for the member's No-Zero calendar for a single month.
 *
 * A "No-Zero day" uses the same definition as the dashboard streak
 * (see {@link file://./../no-zero.ts}): a day on which the member sponsored at
 * least one prospect. The grid surfaces ALL published events the member can
 * see (RLS scopes visibility), with the member's own registration status
 * layered on top — an RSVP makes the day read as "going".
 *
 * All date bucketing is done in UTC to stay consistent with `updateNoZeroStreak`,
 * which derives "today" from `toISOString()`. (Same timezone caveat applies.)
 */

export type DayStatus = "done" | "going" | "zero";

export type DayEvent = {
  id: string;
  title: string;
  type: EventType;
  mode: EventMode;
  /** ISO timestamp of event start. */
  startsAt: string;
  venueName: string | null;
  capacity: number | null;
  /** This member's registration status for the event, if any. */
  registrationStatus: string | null;
};

export type DayProspect = {
  id: string;
  fullName: string;
  stage: string;
};

export type DayCell = {
  /** "YYYY-MM-DD" */
  iso: string;
  day: number;
  status: DayStatus;
  isToday: boolean;
  isFuture: boolean;
  prospects: DayProspect[];
  events: DayEvent[];
};

export type NoZeroMonth = {
  ym: string; // "YYYY-MM"
  monthLabel: string; // "June 2026"
  prevYm: string;
  nextYm: string;
  /** Number of blank cells before day 1 (Sunday-first grid). */
  leadingBlanks: number;
  cells: DayCell[];
  noZeroDays: number;
  /** Streak as stored on the member row (single source of truth). */
  currentStreak: number;
  bestStreak: number;
  /** Whether today (if in this month) is already a No-Zero day. */
  todayIsNoZero: boolean | null;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Parses "YYYY-MM" into a {year, monthIndex}; falls back to the current UTC month. */
export function parseYm(ym?: string | null): { year: number; monthIndex: number } {
  const m = ym?.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const year = Number(m[1]);
    const monthIndex = Number(m[2]) - 1;
    if (monthIndex >= 0 && monthIndex <= 11) return { year, monthIndex };
  }
  const now = new Date();
  return { year: now.getUTCFullYear(), monthIndex: now.getUTCMonth() };
}

type ProspectRow = { id: string; full_name: string; stage: string; created_at: string };
type RegistrationRow = {
  id: string;
  status: string;
  events: {
    id: string;
    title: string;
    event_type: EventType;
    mode: EventMode;
    starts_at: string;
    venue_name: string | null;
    capacity: number | null;
  } | null;
};

type MonthEventRow = {
  id: string;
  title: string;
  event_type: EventType;
  mode: EventMode;
  starts_at: string;
  venue_name: string | null;
  capacity: number | null;
};

export async function buildNoZeroMonth(
  supabase: SupabaseClient,
  member: { id: string; noZeroCurrentStreak: number; noZeroBestStreak: number },
  ym?: string | null,
): Promise<NoZeroMonth> {
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

  const [prospectsRes, registrationsRes, monthEventsRes] = await Promise.all([
    supabase
      .from("prospects")
      .select("id, full_name, stage, created_at")
      .eq("sponsor_member_id", member.id)
      .gte("created_at", monthStart.toISOString())
      .lt("created_at", monthEnd.toISOString())
      .returns<ProspectRow[]>(),
    supabase
      .from("event_registrations")
      .select(
        "id, status, events!inner(id, title, event_type, mode, starts_at, venue_name, capacity)",
      )
      .eq("member_id", member.id)
      .neq("status", "cancelled")
      .gte("events.starts_at", monthStart.toISOString())
      .lt("events.starts_at", monthEnd.toISOString())
      .returns<RegistrationRow[]>(),
    supabase
      .from("events")
      .select("id, title, event_type, mode, starts_at, venue_name, capacity")
      .eq("status", "published")
      .gte("starts_at", monthStart.toISOString())
      .lt("starts_at", monthEnd.toISOString())
      .order("starts_at", { ascending: true })
      .returns<MonthEventRow[]>(),
  ]);

  const prospectsByDay = new Map<string, DayProspect[]>();
  for (const p of prospectsRes.data ?? []) {
    const key = p.created_at.slice(0, 10);
    const list = prospectsByDay.get(key) ?? [];
    list.push({ id: p.id, fullName: p.full_name, stage: p.stage });
    prospectsByDay.set(key, list);
  }

  const regStatusByEventId = new Map<string, string>();
  for (const r of registrationsRes.data ?? []) {
    if (r.events) regStatusByEventId.set(r.events.id, r.status);
  }

  const eventsByDay = new Map<string, DayEvent[]>();
  for (const ev of monthEventsRes.data ?? []) {
    const key = ev.starts_at.slice(0, 10);
    const list = eventsByDay.get(key) ?? [];
    list.push({
      id: ev.id,
      title: ev.title,
      type: ev.event_type,
      mode: ev.mode,
      startsAt: ev.starts_at,
      venueName: ev.venue_name,
      capacity: ev.capacity,
      registrationStatus: regStatusByEventId.get(ev.id) ?? null,
    });
    eventsByDay.set(key, list);
  }

  const cells: DayCell[] = [];
  let noZeroDays = 0;
  let todayIsNoZero: boolean | null = null;

  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${ymStr}-${pad(day)}`;
    const prospects = prospectsByDay.get(iso) ?? [];
    const events = eventsByDay.get(iso) ?? [];
    const isNoZero = prospects.length > 0;
    const isToday = iso === todayIso;
    const isFuture = iso > todayIso;

    if (isNoZero) noZeroDays++;
    if (isToday) todayIsNoZero = isNoZero;

    const hasUpcomingRsvp = events.some((e) => e.registrationStatus === "registered");
    const status: DayStatus = isNoZero ? "done" : hasUpcomingRsvp ? "going" : "zero";

    cells.push({ iso, day, status, isToday, isFuture, prospects, events });
  }

  return {
    ym: ymStr,
    monthLabel,
    prevYm,
    nextYm,
    leadingBlanks,
    cells,
    noZeroDays,
    currentStreak: member.noZeroCurrentStreak,
    bestStreak: member.noZeroBestStreak,
    todayIsNoZero,
  };
}

export type LeaderboardEntry = {
  memberId: string;
  username: string;
  streak: number;
  isYou: boolean;
};

type DownlineMemberRow = {
  id: string;
  username: string;
  no_zero_current_streak: number;
};

/**
 * Builds the team No-Zero leaderboard from the member's genealogy network.
 * RLS lets a member read their own row plus downline rows (depth 1–10), so this
 * returns the member and any readable downline, sorted by current streak.
 * Always includes the member themselves so the card is never empty.
 */
export async function buildTeamLeaderboard(
  supabase: SupabaseClient,
  member: { id: string; username: string; noZeroCurrentStreak: number },
  limit = 12,
): Promise<LeaderboardEntry[]> {
  const genealogy = await supabase
    .from("genealogy")
    .select("descendant_member_id")
    .eq("ancestor_member_id", member.id)
    .gte("depth", 1)
    .lte("depth", 10)
    .returns<{ descendant_member_id: string }[]>();

  const downlineIds = (genealogy.data ?? []).map((g) => g.descendant_member_id);

  const byId = new Map<string, LeaderboardEntry>();
  byId.set(member.id, {
    memberId: member.id,
    username: member.username,
    streak: member.noZeroCurrentStreak,
    isYou: true,
  });

  if (downlineIds.length > 0) {
    const members = await supabase
      .from("members")
      .select("id, username, no_zero_current_streak")
      .in("id", downlineIds)
      .returns<DownlineMemberRow[]>();

    for (const m of members.data ?? []) {
      if (byId.has(m.id)) continue;
      byId.set(m.id, {
        memberId: m.id,
        username: m.username,
        streak: m.no_zero_current_streak,
        isYou: false,
      });
    }
  }

  return Array.from(byId.values())
    .sort((a, b) => b.streak - a.streak || a.username.localeCompare(b.username))
    .slice(0, limit);
}
