import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Data layer for the Muster Reminder modal (read-only dashboard overlay).
 *
 * - "New Prospects" is derived from public.prospects (same query the dashboard
 *   already runs); the other efforts come from public.daily_musters.
 * - E-Points are an append-only ledger (public.epoint_entries); the weekly
 *   caps below are applied at read time so they can change without touching data.
 */

export type MemberState = "active" | "lapsed" | "recruit";

export type MusterToday = {
  prospects: number;
  invited: number;
  presentations: number;
  baseActivations: number;
  debriefed: boolean;
  sales: number;
};

export type EpointParamStatus = {
  key: string;
  name: string;
  app: "daily" | "gema";
  earned: number;
  max: number;
  tip: string;
};

/** The five real-system E-Points parameters with their weekly caps. */
const EPOINT_PARAMS: Omit<EpointParamStatus, "earned">[] = [
  { key: "daily_dose", name: "Daily dose", app: "daily", max: 50, tip: "Log your dose each day" },
  { key: "daily_checkin", name: "Daily check-in", app: "daily", max: 30, tip: "Hydration + how you feel" },
  { key: "my_journey", name: "My Journey", app: "daily", max: 20, tip: "Review your recovery progress" },
  { key: "events", name: "Events", app: "gema", max: 60, tip: "Join or check in at a GEMA event" },
  { key: "team_recognition", name: "Team & recognition", app: "gema", max: 40, tip: "Back your line, cheer a win" },
];

type DailyMusterRow = {
  invited: number;
  presentations: number;
  base_activations: number;
  debriefed: boolean;
  sales: string;
};

/** Monday 00:00 UTC of the current week — E-Points limits reset weekly. */
function weekStartIso(now = new Date()): string {
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday),
  ).toISOString();
}

export async function getMusterData(
  supabase: SupabaseClient,
  memberId: string,
  todayProspectCount: number,
): Promise<{ today: MusterToday; epoints: EpointParamStatus[] }> {
  const todayIso = new Date().toISOString().slice(0, 10);

  const [musterRes, epointsRes] = await Promise.all([
    supabase
      .from("daily_musters")
      .select("invited, presentations, base_activations, debriefed, sales")
      .eq("member_id", memberId)
      .eq("muster_date", todayIso)
      .maybeSingle<DailyMusterRow>(),
    supabase
      .from("epoint_entries")
      .select("param, points")
      .eq("member_id", memberId)
      .gte("awarded_at", weekStartIso())
      .returns<{ param: string; points: number }[]>(),
  ]);

  const row = musterRes.data;
  const earnedByParam = new Map<string, number>();
  for (const entry of epointsRes.data ?? []) {
    earnedByParam.set(entry.param, (earnedByParam.get(entry.param) ?? 0) + entry.points);
  }

  return {
    today: {
      prospects: todayProspectCount,
      invited: row?.invited ?? 0,
      presentations: row?.presentations ?? 0,
      baseActivations: row?.base_activations ?? 0,
      debriefed: row?.debriefed ?? false,
      sales: Number(row?.sales ?? 0),
    },
    epoints: EPOINT_PARAMS.map((p) => ({
      ...p,
      earned: Math.min(p.max, earnedByParam.get(p.key) ?? 0),
    })),
  };
}

/**
 * Adaptive tone for the reminder: recruits get onboarding copy, lapsed members
 * get the "streak is recoverable" framing, everyone else the active push.
 */
export function deriveMemberState(
  currentStreak: number,
  bestStreak: number,
  joinedAt: string | null,
): MemberState {
  const joinedRecently =
    joinedAt !== null && Date.now() - new Date(joinedAt).getTime() < 14 * 86_400_000;
  if (joinedRecently || bestStreak === 0) return "recruit";
  if (currentStreak === 0) return "lapsed";
  return "active";
}

/** Monthly No-Zero target: days in the current month minus Sundays (rest days). */
export function workingDaysThisMonth(d = new Date()): number {
  const year = d.getUTCFullYear();
  const monthIndex = d.getUTCMonth();
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  let sundays = 0;
  for (let day = 1; day <= days; day++) {
    if (new Date(Date.UTC(year, monthIndex, day)).getUTCDay() === 0) sundays++;
  }
  return days - sundays;
}
