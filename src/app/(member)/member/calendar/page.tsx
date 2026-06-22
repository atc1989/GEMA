import { requireMember } from "@/lib/auth/require-member";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildNoZeroMonth, buildTeamLeaderboard } from "@/lib/calendar/no-zero-month";
import { NoZeroCalendar } from "@/components/calendar/no-zero-calendar";

type MemberStreakRow = {
  no_zero_current_streak: number;
  no_zero_best_streak: number;
};

export default async function MemberCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const ctx = await requireMember();
  const supabase = await createSupabaseServerClient();

  const streak = await supabase
    .from("members")
    .select("no_zero_current_streak, no_zero_best_streak")
    .eq("id", ctx.member.id)
    .maybeSingle<MemberStreakRow>();

  const currentStreak = streak.data?.no_zero_current_streak ?? 0;

  const [monthData, leaderboard] = await Promise.all([
    buildNoZeroMonth(
      supabase,
      {
        id: ctx.member.id,
        noZeroCurrentStreak: currentStreak,
        noZeroBestStreak: streak.data?.no_zero_best_streak ?? 0,
      },
      month,
    ),
    buildTeamLeaderboard(supabase, {
      id: ctx.member.id,
      username: ctx.member.username,
      noZeroCurrentStreak: currentStreak,
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
