import Link from "next/link";
import { CalendarDays, Coins, Gift, Ticket, Users } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { NoZeroStreak } from "@/components/member/no-zero-streak";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentMember } from "@/lib/auth/require-member";
import { updateNoZeroStreak } from "@/lib/no-zero";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type ProspectRow = {
  id: string;
  full_name: string;
  email: string | null;
  stage: string;
  created_at: string;
};

type MemberNoZeroRow = {
  no_zero_current_streak: number;
  no_zero_best_streak: number;
  metadata: Record<string, unknown>;
};

export default async function MemberDashboardPage() {
  const ctx = await getCurrentMember();
  const member = ctx!.member;
  const profileId = ctx!.profile.id;

  const supabase = await createSupabaseServerClient();

  const today = new Date().toISOString().split("T")[0]!;

  const [
    referrals,
    attributed,
    prospectsCount,
    hostedEvents,
    recentProspects,
    myCommissions,
    memberNoZeroData,
    todayProspects,
  ] = await Promise.all([
    supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_member_id", member.id),
    supabase
      .from("event_registrations")
      .select("id", { count: "exact", head: true })
      .eq("sponsor_member_id", member.id),
    supabase
      .from("prospects")
      .select("id", { count: "exact", head: true })
      .eq("sponsor_member_id", member.id),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .or(`host_member_id.eq.${member.id},created_by_profile_id.eq.${profileId}`),
    supabase
      .from("prospects")
      .select("id, full_name, email, stage, created_at")
      .eq("sponsor_member_id", member.id)
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<ProspectRow[]>(),
    supabase
      .from("commissions")
      .select("amount, status")
      .eq("earner_member_id", member.id)
      .returns<{ amount: string; status: string }[]>(),
    supabase
      .from("members")
      .select("no_zero_current_streak, no_zero_best_streak, metadata")
      .eq("id", member.id)
      .maybeSingle<MemberNoZeroRow>(),
    supabase
      .from("prospects")
      .select("id", { count: "exact", head: true })
      .eq("sponsor_member_id", member.id)
      .gte("created_at", `${today}T00:00:00.000Z`),
  ]);

  const pendingEarnings = (myCommissions.data ?? [])
    .filter((c) => c.status === "pending")
    .reduce((acc, c) => acc + Number(c.amount), 0);

  const noZero = await updateNoZeroStreak(
    supabase,
    member.id,
    todayProspects.count ?? 0,
    memberNoZeroData.data ?? null,
  );

  return (
    <div className="grid gap-4">
      <p className="text-sm font-semibold text-muted-foreground">
        @{member.username} · {member.memberCode}
      </p>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <DashboardCard
          icon={Gift}
          label="Referral links"
          value={String(referrals.count ?? 0)}
          tone="gold"
        />
        <DashboardCard
          icon={Ticket}
          label="Attributed sign-ups"
          value={String(attributed.count ?? 0)}
          tone="success"
        />
        <DashboardCard
          icon={Users}
          label="Sponsored prospects"
          value={String(prospectsCount.count ?? 0)}
          tone="purple"
        />
        <DashboardCard
          icon={CalendarDays}
          label="My events"
          value={String(hostedEvents.count ?? 0)}
        />
        <DashboardCard
          icon={Coins}
          label="Pending earnings"
          value={`₱${pendingEarnings.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          tone="gold"
        />
      </section>

      <NoZeroStreak {...noZero} />

      <div className="flex flex-wrap gap-2">
        <Link href="/member/referrals" className={cn(buttonVariants({ variant: "brand" }))}>
          <Gift aria-hidden="true" />
          Share &amp; referrals
        </Link>
        <Link href="/member/prospects" className={cn(buttonVariants({ variant: "outline" }))}>
          <Users aria-hidden="true" />
          My prospects
        </Link>
        <Link href="/member/earnings" className={cn(buttonVariants({ variant: "outline" }))}>
          <Coins aria-hidden="true" />
          Earnings
        </Link>
      </div>

      <Card className="p-0">
        <div className="border-b border-border/70 px-4 py-3 text-sm font-bold">
          Recent referred prospects
        </div>
        {(recentProspects.data ?? []).length === 0 ? (
          <EmptyState
            icon={Users}
            title="No referred prospects yet"
            description="Share a referral link to an event — prospects who register through it show up here."
            className="border-0 shadow-none"
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {(recentProspects.data ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{p.full_name}</p>
                  <p className="truncate text-xs font-semibold text-muted-foreground">
                    {p.email ?? "—"}
                  </p>
                </div>
                <span className="shrink-0 rounded-lg bg-secondary px-2 py-1 text-[10px] font-black uppercase tracking-wide text-brand">
                  {p.stage}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
