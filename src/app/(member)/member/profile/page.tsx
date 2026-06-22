import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Award,
  BadgeCheck,
  CalendarDays,
  ChevronRight,
  Coins,
  Flame,
  Gift,
  IdCard,
  Settings,
  ShieldCheck,
  Ticket,
  Trophy,
  User,
  Users,
} from "lucide-react";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireMember } from "@/lib/auth/require-member";
import type { CommissionStatus, ProspectStage } from "@/lib/database/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type MemberProfileRow = {
  rank_id: number | null;
  joined_at: string | null;
  activated_at: string | null;
  no_zero_current_streak: number;
  no_zero_best_streak: number;
};

type RankRow = {
  id: number;
  code: string;
  name: string;
  level: number;
  description: string | null;
};

type ProspectRow = {
  id: string;
  full_name: string;
  email: string | null;
  stage: ProspectStage;
  converted_member_id: string | null;
  created_at: string;
};

type CommissionRow = {
  amount: string;
  status: CommissionStatus;
};

type ReferralRow = {
  ref_code: string;
  status: string;
  event_id: string | null;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "M";
}

function formatDate(iso: string | null) {
  if (!iso) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function peso(n: number) {
  return `PHP ${n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function MemberProfilePage() {
  const { profile, member } = await requireMember();
  const supabase = await createSupabaseServerClient();

  const [
    memberProfileRes,
    ranksRes,
    prospectsRes,
    referralsRes,
    registrationsRes,
    commissionsRes,
  ] = await Promise.all([
    supabase
      .from("members")
      .select("rank_id, joined_at, activated_at, no_zero_current_streak, no_zero_best_streak")
      .eq("id", member.id)
      .maybeSingle<MemberProfileRow>(),
    supabase
      .from("ranks")
      .select("id, code, name, level, description")
      .eq("active", true)
      .order("level", { ascending: true })
      .returns<RankRow[]>(),
    supabase
      .from("prospects")
      .select("id, full_name, email, stage, converted_member_id, created_at")
      .eq("sponsor_member_id", member.id)
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<ProspectRow[]>(),
    supabase
      .from("referrals")
      .select("ref_code, status, event_id")
      .eq("referrer_member_id", member.id)
      .returns<ReferralRow[]>(),
    supabase
      .from("event_registrations")
      .select("id", { count: "exact", head: true })
      .eq("member_id", member.id)
      .eq("status", "attended"),
    supabase
      .from("commissions")
      .select("amount, status")
      .eq("earner_member_id", member.id)
      .returns<CommissionRow[]>(),
  ]);

  const memberProfile = memberProfileRes.data;
  const ranks = ranksRes.data ?? [];
  const currentRank =
    ranks.find((rank) => rank.id === memberProfile?.rank_id) ??
    ranks.find((rank) => rank.level === 0) ??
    null;
  const nextRank = currentRank
    ? ranks.find((rank) => rank.level > currentRank.level)
    : ranks[0] ?? null;
  const highestLevel = Math.max(...ranks.map((rank) => rank.level), currentRank?.level ?? 0, 1);
  const rankProgress = Math.round(((currentRank?.level ?? 0) / highestLevel) * 100);

  const prospects = prospectsRes.data ?? [];
  const referrals = referralsRes.data ?? [];
  const commissions = commissionsRes.data ?? [];
  const convertedProspects = prospects.filter((p) => p.converted_member_id).length;
  const paidEarnings = commissions
    .filter((commission) => commission.status === "paid")
    .reduce((acc, commission) => acc + Number(commission.amount), 0);
  const pendingEarnings = commissions
    .filter((commission) => commission.status === "pending")
    .reduce((acc, commission) => acc + Number(commission.amount), 0);
  const attendedEvents = registrationsRes.count ?? 0;

  const currentStreak = memberProfile?.no_zero_current_streak ?? 0;
  const bestStreak = memberProfile?.no_zero_best_streak ?? 0;

  const badges = [
    {
      label: "First Sponsor",
      description: "Sponsor your first prospect.",
      earned: prospects.length > 0,
      icon: Users,
    },
    {
      label: "No-Zero 7",
      description: "Reach a 7-day No-Zero streak.",
      earned: bestStreak >= 7 || currentStreak >= 7,
      icon: Flame,
    },
    {
      label: "First Conversion",
      description: "Convert a sponsored prospect.",
      earned: convertedProspects > 0,
      icon: BadgeCheck,
    },
    {
      label: "Paid Builder",
      description: "Receive a paid commission.",
      earned: paidEarnings > 0,
      icon: Coins,
    },
    {
      label: "Rank Progress",
      description: "Move beyond the starting rank.",
      earned: (currentRank?.level ?? 0) > 0,
      icon: Trophy,
    },
    {
      label: "Referral Ready",
      description: "Create at least one referral link.",
      earned: referrals.length > 0,
      icon: Gift,
    },
  ];
  const earnedBadges = badges.filter((badge) => badge.earned).length;
  const activeReferral = referrals.find((referral) => referral.status === "active") ?? referrals[0];

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4">
      <ProfileHero
        displayName={profile.fullName || member.username}
        email={profile.email}
        memberCode={member.memberCode}
        rankName={currentRank?.name ?? "Member"}
        status={member.status}
        username={member.username}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <DashboardCard
          icon={Flame}
          label="Current streak"
          value={`${currentStreak}d`}
          helper={`Best: ${bestStreak}d`}
          tone="gold"
        />
        <DashboardCard
          icon={Users}
          label="Prospects"
          value={String(prospects.length)}
          helper={`${convertedProspects} converted`}
          tone="purple"
        />
        <DashboardCard
          icon={Ticket}
          label="Events attended"
          value={String(attendedEvents)}
          helper="Checked-in events"
        />
        <DashboardCard
          icon={Gift}
          label="Referral links"
          value={String(referrals.length)}
          helper={activeReferral ? activeReferral.ref_code : "Create one"}
          tone="success"
        />
        <DashboardCard
          icon={Coins}
          label="Pending earnings"
          value={peso(pendingEarnings)}
          tone="gold"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                Rank progress
              </p>
              <h2 className="mt-1 font-heading text-xl font-extrabold tracking-tight">
                {currentRank?.name ?? "Member"}
              </h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
                {nextRank
                  ? `${rankProgress}% toward ${nextRank.name}.`
                  : "Top rank reached. Keep leading your team."}
              </p>
            </div>
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-brand">
              <ShieldCheck className="size-6" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-5 h-3 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-linear-to-r from-brand to-success"
              style={{ width: `${Math.max(rankProgress, 8)}%` }}
            />
          </div>
          <div className="mt-4 grid gap-2">
            {ranks.map((rank) => (
              <div
                key={rank.id}
                className={cn(
                  "flex items-center justify-between rounded-xl border px-3 py-2 text-sm",
                  rank.id === currentRank?.id
                    ? "border-brand/30 bg-secondary text-brand"
                    : "border-border/70 bg-background text-muted-foreground",
                )}
              >
                <span className="font-bold">{rank.name}</span>
                <span className="text-xs font-black uppercase tracking-wide">{rank.code}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                Referral card
              </p>
              <h2 className="mt-1 font-heading text-lg font-extrabold tracking-tight">
                Share Gutguard through events
              </h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
                Create a personal event link so guests register under your sponsorship.
              </p>
            </div>
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-gold">
              <Gift className="size-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-border bg-muted/40 px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
              Active code
            </p>
            <p className="mt-1 font-mono text-sm font-black">
              {activeReferral?.ref_code ?? "No referral link yet"}
            </p>
          </div>
          <Link
            href="/member/referrals"
            className={cn(buttonVariants({ variant: "brand" }), "mt-4 w-full")}
          >
            <Gift aria-hidden="true" />
            Manage referral links
          </Link>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-base font-extrabold tracking-tight">
                Badges
              </h2>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                {earnedBadges}/{badges.length} earned from current member data.
              </p>
            </div>
            <Award className="size-5 text-gold" aria-hidden="true" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {badges.map((badge) => {
              const Icon = badge.icon;
              return (
                <div
                  key={badge.label}
                  className={cn(
                    "min-h-[112px] rounded-xl border p-3",
                    badge.earned
                      ? "border-brand/25 bg-secondary text-brand"
                      : "border-border/70 bg-muted/30 text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  <p className="mt-2 text-sm font-black">{badge.label}</p>
                  <p className="mt-1 text-[11px] font-semibold leading-4">{badge.description}</p>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-0">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
            <div>
              <h2 className="font-heading text-base font-extrabold tracking-tight">
                Recent sponsored prospects
              </h2>
              <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                Latest people attributed to you.
              </p>
            </div>
            <Link
              href="/member/prospects"
              className="text-xs font-black text-brand underline-offset-4 hover:underline"
            >
              View all
            </Link>
          </div>
          {prospects.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No prospects yet"
              description="Create and share a referral link to start filling this list."
              className="border-0 shadow-none"
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {prospects.map((prospect) => (
                <li
                  key={prospect.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{prospect.full_name}</p>
                    <p className="truncate text-xs font-semibold text-muted-foreground">
                      {prospect.email ?? formatDate(prospect.created_at)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-secondary px-2 py-1 text-[10px] font-black uppercase tracking-wide text-brand">
                    {prospect.converted_member_id ? "converted" : prospect.stage}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="grid gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Quick links
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink href="/member/events" icon={CalendarDays} label="Events and passes" />
          <QuickLink href="/member/prospects" icon={Users} label="My prospects" />
          <QuickLink href="/member/earnings" icon={Coins} label="Earnings" />
          <QuickLink href="/member/settings" icon={Settings} label="Account settings" />
        </div>
      </section>

      <Card className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <h2 className="font-heading text-base font-extrabold tracking-tight">
            Member record
          </h2>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Joined {formatDate(memberProfile?.joined_at ?? null)} / activated{" "}
            {formatDate(memberProfile?.activated_at ?? null)}
          </p>
        </div>
        <Link href="/member/settings" className={cn(buttonVariants({ variant: "outline" }))}>
          <Settings aria-hidden="true" />
          Security settings
        </Link>
      </Card>
    </div>
  );
}

function ProfileHero({
  displayName,
  email,
  memberCode,
  rankName,
  status,
  username,
}: {
  displayName: string;
  email: string | null;
  memberCode: string;
  rankName: string;
  status: string;
  username: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-linear-to-br from-brand to-brand-dark text-white shadow-[0_18px_50px_rgb(14_34_73/18%)]">
      <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center lg:p-6">
        <div className="flex size-20 items-center justify-center rounded-2xl bg-white/12 text-2xl font-black ring-1 ring-white/20">
          {initials(displayName)}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-100">
            Member profile
          </p>
          <h1 className="mt-1 truncate font-heading text-3xl font-extrabold tracking-tight">
            {displayName}
          </h1>
          <p className="mt-1 truncate text-sm font-semibold text-blue-100">
            @{username} / {rankName}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/12 px-2.5 py-1 text-xs font-black ring-1 ring-white/16">
              <IdCard className="size-3.5" aria-hidden="true" />
              {memberCode}
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/12 px-2.5 py-1 text-xs font-black uppercase tracking-wide ring-1 ring-white/16">
              <User className="size-3.5" aria-hidden="true" />
              {status}
            </span>
            {email ? (
              <span className="inline-flex max-w-full items-center gap-1 truncate rounded-lg bg-white/12 px-2.5 py-1 text-xs font-bold ring-1 ring-white/16">
                {email}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link href={href} className="group block">
      <Card className="flex items-center justify-between gap-3 p-4 transition-colors group-hover:border-brand/40">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-brand">
            <Icon className="size-5" aria-hidden="true" />
          </div>
          <span className="truncate text-sm font-black">{label}</span>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Card>
    </Link>
  );
}
