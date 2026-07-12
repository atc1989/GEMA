import { requireMember } from "@/lib/auth/require-member";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildNoZeroMonth, buildTeamLeaderboard } from "@/lib/calendar/no-zero-month";
import { updateNoZeroStreak } from "@/lib/no-zero";
import { NoZeroCalendar } from "@/components/calendar/no-zero-calendar";

type MemberStreakRow = {
  no_zero_current_streak: number;
  no_zero_best_streak: number;
  metadata: Record<string, unknown>;
};

export default async function MemberCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const ctx = await requireMember();
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);

  const [streakRow, todayProspects] = await Promise.all([
    supabase
      .from("members")
      .select("no_zero_current_streak, no_zero_best_streak, metadata")
      .eq("id", ctx.member.id)
      .maybeSingle<MemberStreakRow>(),
    supabase
      .from("prospects")
      .select("id", { count: "exact", head: true })
      .eq("sponsor_member_id", ctx.member.id)
      .gte("created_at", `${today}T00:00:00.000Z`),
  ]);

  // Same reconciliation the dashboard does, so the streak here is never stale.
  const noZero = await updateNoZeroStreak(
    supabase,
    ctx.member.id,
    todayProspects.count ?? 0,
    streakRow.data ?? null,
  );

  const [monthData, leaderboard] = await Promise.all([
    buildNoZeroMonth(
      supabase,
      {
        id: ctx.member.id,
        profileId: ctx.profile.id,
        noZeroCurrentStreak: noZero.currentStreak,
        noZeroBestStreak: noZero.bestStreak,
      },
      month,
    ),
    buildTeamLeaderboard(supabase, {
      id: ctx.member.id,
      username: ctx.member.username,
      noZeroCurrentStreak: noZero.currentStreak,
    }),
  ]);

  const todayWeekday = new Date().getUTCDay();

  return (
    <NoZeroCalendar
      month={monthData}
      todayWeekday={todayWeekday}
      leaderboard={leaderboard}
    />
  );
}
