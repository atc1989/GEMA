import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Flame, Gift, Link2, Ticket, UserCheck, Users } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatEventDateTime } from "@/lib/utils/format";

type MemberDetailRow = {
  id: string;
  username: string;
  member_code: string;
  status: string;
  joined_at: string | null;
  created_at: string;
  no_zero_current_streak: number;
  no_zero_best_streak: number;
  profile_id: string;
};

type ProspectRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  stage: string;
  source: string | null;
  created_at: string;
  converted_member_id: string | null;
};

type ReferralRow = {
  id: string;
  ref_code: string;
  status: string;
  event_id: string | null;
  created_at: string;
};

export default async function AdminMemberDetailPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: member } = await supabase
    .from("members")
    .select(
      "id, username, member_code, status, joined_at, created_at, no_zero_current_streak, no_zero_best_streak, profile_id",
    )
    .eq("id", memberId)
    .maybeSingle<MemberDetailRow>();

  if (!member) notFound();

  const [{ data: profile }, prospectsRes, referralsRes, attributedRes, refRegsRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("id", member.profile_id)
        .maybeSingle<{ full_name: string; email: string | null; phone: string | null }>(),
      supabase
        .from("prospects")
        .select("id, full_name, email, phone, stage, source, created_at, converted_member_id")
        .eq("sponsor_member_id", memberId)
        .order("created_at", { ascending: false })
        .returns<ProspectRow[]>(),
      supabase
        .from("referrals")
        .select("id, ref_code, status, event_id, created_at")
        .eq("referrer_member_id", memberId)
        .order("created_at", { ascending: false })
        .returns<ReferralRow[]>(),
      supabase
        .from("event_registrations")
        .select("id", { count: "exact", head: true })
        .eq("sponsor_member_id", memberId),
      supabase
        .from("event_registrations")
        .select("referral_id")
        .eq("sponsor_member_id", memberId)
        .not("referral_id", "is", null)
        .returns<{ referral_id: string }[]>(),
    ]);

  const prospects = prospectsRes.data ?? [];
  const referrals = referralsRes.data ?? [];

  const viaLinks = prospects.filter((p) => p.source === "member_referral").length;
  const converted = prospects.filter((p) => p.converted_member_id).length;

  // Sign-ups brought in per referral link.
  const regsByReferral = new Map<string, number>();
  for (const r of refRegsRes.data ?? []) {
    regsByReferral.set(r.referral_id, (regsByReferral.get(r.referral_id) ?? 0) + 1);
  }

  // Event titles for links tied to a specific event.
  const eventIds = [...new Set(referrals.map((r) => r.event_id).filter(Boolean))] as string[];
  const eventTitleById = new Map<string, string>();
  if (eventIds.length > 0) {
    const { data: events } = await supabase
      .from("events")
      .select("id, title")
      .in("id", eventIds)
      .returns<{ id: string; title: string }[]>();
    for (const e of events ?? []) eventTitleById.set(e.id, e.title);
  }

  return (
    <div className="grid gap-4">
      <Link
        href="/admin/members"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All members
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black tracking-tight">
            {profile?.full_name ?? `@${member.username}`}
          </h2>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            @{member.username} · {member.member_code} · {profile?.email ?? "no email"}
            {profile?.phone ? ` · ${profile.phone}` : ""}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
            Joined {formatEventDateTime(member.joined_at ?? member.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-secondary px-2 py-1 text-[10px] font-black uppercase tracking-wide text-brand">
            {member.status}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-gold-dark">
            <Flame className="size-3" aria-hidden="true" />
            {member.no_zero_current_streak} day streak · best {member.no_zero_best_streak}
          </span>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <DashboardCard icon={Users} label="Prospects" value={String(prospects.length)} tone="purple" />
        <DashboardCard icon={Gift} label="Via referral links" value={String(viaLinks)} tone="gold" />
        <DashboardCard icon={UserCheck} label="Converted" value={String(converted)} tone="success" />
        <DashboardCard icon={Ticket} label="Attributed sign-ups" value={String(attributedRes.count ?? 0)} />
        <DashboardCard icon={Link2} label="Referral links" value={String(referrals.length)} />
      </section>

      <Card className="p-0">
        <div className="border-b border-border/70 px-4 py-3 text-sm font-bold">
          Prospects under this member
        </div>
        {prospects.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No prospects yet"
            description="Prospects sponsored by this member will appear here."
            className="border-0 shadow-none"
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {prospects.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{p.full_name}</p>
                  <p className="truncate text-xs font-semibold text-muted-foreground">
                    {[p.email, p.phone].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
                    {p.source === "member_referral" ? "Via referral link" : p.source ?? "—"} ·{" "}
                    {formatEventDateTime(p.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {p.converted_member_id ? (
                    <span className="text-[10px] font-black uppercase tracking-wide text-success">
                      Converted
                    </span>
                  ) : null}
                  <span className="rounded-lg bg-secondary px-2 py-1 text-[10px] font-black uppercase tracking-wide text-brand">
                    {p.stage}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-0">
        <div className="border-b border-border/70 px-4 py-3 text-sm font-bold">
          Referral link performance
        </div>
        {referrals.length === 0 ? (
          <EmptyState
            icon={Link2}
            title="No referral links yet"
            description="Links this member creates will appear here with their sign-up counts."
            className="border-0 shadow-none"
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {referrals.map((r) => {
              const signups = regsByReferral.get(r.id) ?? 0;
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-bold">{r.ref_code}</p>
                    <p className="truncate text-xs font-semibold text-muted-foreground">
                      {r.event_id
                        ? eventTitleById.get(r.event_id) ?? "Event link"
                        : "General link"}{" "}
                      · created {formatEventDateTime(r.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs font-black text-brand">
                      {signups} sign-up{signups === 1 ? "" : "s"}
                    </span>
                    <span className="rounded-lg bg-secondary px-2 py-1 text-[10px] font-black uppercase tracking-wide text-brand">
                      {r.status}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
