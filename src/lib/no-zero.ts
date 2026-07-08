import type { SupabaseClient } from "@supabase/supabase-js";

export type NoZeroResult = {
  currentStreak: number;
  bestStreak: number;
  isActiveToday: boolean;
};

type MemberNoZeroRow = {
  no_zero_current_streak: number;
  no_zero_best_streak: number;
  metadata: Record<string, unknown>;
} | null;

/**
 * Reads today's prospect-sponsorship count and updates the member's No-Zero streak
 * if needed. Called from the member dashboard RSC so no "use server" required.
 *
 * Rules:
 *  - A "No-Zero day" = at least 1 prospect with sponsor_member_id = member on that day.
 *  - Already counted today → no-op.
 *  - Sundays are rest days and never break a streak: the streak survives when the
 *    last active date is on/after the previous *working* day (Monday looks back to
 *    Saturday; working a Sunday still counts as activity and never hurts).
 *  - Active today + last date >= previous working day → extend streak.
 *  - Active today + gap → reset streak to 1.
 *  - Not active today + last date < previous working day + streak > 0 → broken, reset to 0.
 */
export async function updateNoZeroStreak(
  supabase: SupabaseClient,
  memberId: string,
  todayProspectCount: number,
  memberRow: MemberNoZeroRow,
): Promise<NoZeroResult> {
  const currentStreak = memberRow?.no_zero_current_streak ?? 0;
  const bestStreak = memberRow?.no_zero_best_streak ?? 0;
  const metadata = (memberRow?.metadata ?? {}) as Record<string, unknown>;
  const lastDate = (metadata.no_zero_last_date ?? null) as string | null;

  const today = new Date().toISOString().split("T")[0]!;
  // Previous working day: yesterday, or Saturday when today is Monday (Sunday rest).
  const todayWeekday = new Date(`${today}T00:00:00.000Z`).getUTCDay();
  const prevWorkingDay = new Date(Date.now() - (todayWeekday === 1 ? 2 : 1) * 86_400_000)
    .toISOString()
    .split("T")[0]!;

  const isActiveToday = todayProspectCount > 0;

  if (lastDate === today) {
    return { currentStreak, bestStreak, isActiveToday };
  }

  let newStreak = currentStreak;
  let newBest = bestStreak;
  let shouldUpdate = false;

  if (isActiveToday) {
    newStreak = lastDate && lastDate >= prevWorkingDay ? currentStreak + 1 : 1;
    newBest = Math.max(bestStreak, newStreak);
    shouldUpdate = true;
  } else if (currentStreak > 0 && lastDate && lastDate < prevWorkingDay) {
    newStreak = 0;
    shouldUpdate = true;
  }

  if (shouldUpdate) {
    await supabase
      .from("members")
      .update({
        no_zero_current_streak: newStreak,
        no_zero_best_streak: newBest,
        metadata: {
          ...metadata,
          no_zero_last_date: isActiveToday ? today : null,
        },
      })
      .eq("id", memberId);
  }

  return { currentStreak: newStreak, bestStreak: newBest, isActiveToday };
}
