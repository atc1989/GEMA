import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Coins,
  Flame,
  Gift,
  MapPin,
  Monitor,
  Ticket,
  Users,
} from "lucide-react";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DashboardTipsCard } from "@/components/dashboard/dashboard-tips-card";
import { MusterReminder } from "@/components/dashboard/muster-reminder";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentMember } from "@/lib/auth/require-member";
import { buildNoZeroMonth, type DayCell } from "@/lib/calendar/no-zero-month";
import { WEEK_GUIDE, WEEKDAY_LETTERS, WEEKDAY_NAMES } from "@/lib/calendar/weekly-guide";
import type { EventMode, EventType, RegistrationStatus } from "@/lib/database/types";
import { deriveMemberState, getMusterData, workingDaysThisMonth } from "@/lib/muster";
import { updateNoZeroStreak, type NoZeroResult } from "@/lib/no-zero";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { formatEventDateTime } from "@/lib/utils/format";

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
  joined_at: string | null;
  metadata: Record<string, unknown>;
};

type RegistrationEventRow = {
  id: string;
  status: RegistrationStatus;
  events: {
    id: string;
    title: string;
    event_type: EventType;
    starts_at: string;
    timezone: string;
    venue_name: string | null;
    online_url: string | null;
    mode: EventMode;
  } | null;
};

function firstName(name: string | null, fallback: string) {
  return (name ?? fallback).trim().split(/\s+/)[0] ?? fallback;
}

function currentWeekCells(monthCells: DayCell[]) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const today = new Date(`${todayIso}T00:00:00.000Z`);
  const sunday = new Date(today);
  sunday.setUTCDate(today.getUTCDate() - today.getUTCDay());

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sunday);
    date.setUTCDate(sunday.getUTCDate() + index);
    const iso = date.toISOString().slice(0, 10);
    return monthCells.find((cell) => cell.iso === iso) ?? null;
  });
}

export default async function MemberDashboardPage() {
  const ctx = await getCurrentMember();
  const member = ctx!.member;
  const profile = ctx!.profile;
  const profileId = profile.id;

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
    registrations,
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
      .select("no_zero_current_streak, no_zero_best_streak, joined_at, metadata")
      .eq("id", member.id)
      .maybeSingle<MemberNoZeroRow>(),
    supabase
      .from("prospects")
      .select("id", { count: "exact", head: true })
      .eq("sponsor_member_id", member.id)
      .gte("created_at", `${today}T00:00:00.000Z`),
    supabase
      .from("event_registrations")
      .select(
        "id, status, events!inner(id, title, event_type, starts_at, timezone, venue_name, online_url, mode)",
      )
      .eq("member_id", member.id)
      .eq("status", "registered")
      .gte("events.starts_at", `${today}T00:00:00.000Z`)
      .limit(20)
      .returns<RegistrationEventRow[]>(),
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

  const [month, muster] = await Promise.all([
    buildNoZeroMonth(
      supabase,
      {
        id: member.id,
        noZeroCurrentStreak: noZero.currentStreak,
        noZeroBestStreak: noZero.bestStreak,
      },
      today.slice(0, 7),
    ),
    getMusterData(supabase, member.id, todayProspects.count ?? 0),
  ]);

  const memberState = deriveMemberState(
    noZero.currentStreak,
    noZero.bestStreak,
    memberNoZeroData.data?.joined_at ?? null,
  );

  const nextRegistration = (registrations.data ?? [])
    .filter((registration) => registration.events)
    .sort((a, b) => {
      const aStartsAt = a.events?.starts_at ?? "";
      const bStartsAt = b.events?.starts_at ?? "";
      return aStartsAt.localeCompare(bStartsAt);
    })[0];

  const todayWeekday = new Date(`${today}T00:00:00.000Z`).getUTCDay();
  const todayGuide = WEEK_GUIDE[todayWeekday] ?? WEEK_GUIDE[0]!;

  return (
    <div className="grid gap-4">
      <MusterReminder
        memberName={firstName(profile.fullName, member.username)}
        state={memberState}
        streak={noZero.currentStreak}
        bestStreak={noZero.bestStreak}
        monthNoZero={month.noZeroDays}
        monthlyTarget={workingDaysThisMonth()}
        today={muster.today}
        epoints={muster.epoints}
        dailyUrl="/gutguard-daily"
        bulletinUrl={process.env.NEXT_PUBLIC_TELEGRAM_BULLETIN_URL ?? null}
      />

      <TodayHero
        displayName={firstName(profile.fullName, member.username)}
        memberCode={member.memberCode}
        noZero={noZero}
        noZeroDays={month.noZeroDays}
        todayGuide={todayGuide}
        todayWeekday={todayWeekday}
        username={member.username}
        weekCells={currentWeekCells(month.cells)}
      />

      <DashboardTipsCard />

      <NextEventCard registration={nextRegistration ?? null} />

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
          Sponsored prospects
        </div>
        {(recentProspects.data ?? []).length === 0 ? (
          <EmptyState
            icon={Users}
            title="No sponsored prospects yet"
            description="Share a referral link to an event. Prospects who register through it show up here."
            className="border-0 shadow-none"
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {(recentProspects.data ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{p.full_name}</p>
                  <p className="truncate text-xs font-semibold text-muted-foreground">
                    {p.email ?? "No email yet"}
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
          value={`PHP ${pendingEarnings.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
          tone="gold"
        />
      </section>
    </div>
  );
}

function TodayHero({
  displayName,
  memberCode,
  noZero,
  noZeroDays,
  todayGuide,
  todayWeekday,
  username,
  weekCells,
}: {
  displayName: string;
  memberCode: string;
  noZero: NoZeroResult;
  noZeroDays: number;
  todayGuide: (typeof WEEK_GUIDE)[number];
  todayWeekday: number;
  username: string;
  weekCells: (DayCell | null)[];
}) {
  const TodayIcon = todayGuide.icon;

  return (
    <section className="overflow-hidden rounded-2xl bg-linear-to-br from-brand to-brand-dark text-white shadow-[0_18px_50px_rgb(14_34_73/18%)]">
      <div className="grid gap-5 p-5 lg:grid-cols-[1.25fr_0.75fr] lg:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-100">
            @{username} / {memberCode}
          </p>
          <h2 className="mt-2 font-heading text-3xl font-extrabold tracking-tight">
            Hello, {displayName}
          </h2>
          <p className="mt-2 text-sm font-semibold text-blue-100">
            {WEEKDAY_NAMES[todayWeekday]} / {todayGuide.label} / {todayGuide.time}
          </p>

          <div className="mt-5 flex items-center gap-3">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/12 text-amber-300 ring-1 ring-white/16">
              <Flame className="size-8" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-heading text-4xl font-black leading-none">
                  {noZero.currentStreak}
                </span>
                <span className="text-sm font-bold text-blue-100">day streak</span>
              </div>
              <p className="mt-1 text-xs font-semibold text-blue-100">
                {noZeroDays} No-Zero days this month / best streak {noZero.bestStreak}
              </p>
            </div>
          </div>

          <div
            className={cn(
              "mt-5 flex items-start gap-2 rounded-xl px-3 py-3 text-sm font-bold ring-1",
              noZero.isActiveToday
                ? "bg-emerald-400/15 text-emerald-50 ring-emerald-200/25"
                : "bg-amber-300/15 text-amber-50 ring-amber-100/25",
            )}
          >
            {noZero.isActiveToday ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            ) : (
              <Flame className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            )}
            <span>
              {noZero.isActiveToday
                ? "No-Zero secured today. Keep the chain alive."
                : "Today is still open. Sponsor a prospect to secure your No-Zero."}
            </span>
          </div>
        </div>

        <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/16">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-blue-100">
            <TodayIcon className="size-4" aria-hidden="true" />
            This week
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weekCells.map((cell, index) => (
              <div
                key={`${WEEKDAY_LETTERS[index]}-${index}`}
                className={cn(
                  "flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-xl border px-1 text-center",
                  cell?.isToday
                    ? "border-amber-200 bg-white text-brand-dark"
                    : "border-white/12 bg-white/8 text-white",
                )}
              >
                <span className="text-[10px] font-black text-current/70">
                  {WEEKDAY_LETTERS[index]}
                </span>
                <span className="font-heading text-sm font-black">{cell?.day ?? "-"}</span>
                <span
                  className={cn(
                    "size-2 rounded-full",
                    cell?.status === "done"
                      ? "bg-emerald-400"
                      : cell?.status === "going"
                        ? "bg-amber-300"
                        : "bg-white/35",
                  )}
                />
              </div>
            ))}
          </div>
          <Link
            href="/member/calendar"
            className="mt-3 inline-flex text-xs font-black text-blue-100 underline-offset-4 hover:underline"
          >
            Open No-Zero Calendar
          </Link>
        </div>
      </div>
    </section>
  );
}

function NextEventCard({ registration }: { registration: RegistrationEventRow | null }) {
  const event = registration?.events;

  if (!event) {
    return (
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-brand">
            <CalendarDays className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-sm font-extrabold tracking-tight">
              RSVP your next event
            </h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
              Reserve a seat and keep your QR pass ready for check-in.
            </p>
            <Link
              href="/member/events"
              className={cn(buttonVariants({ variant: "brand", size: "sm" }), "mt-3")}
            >
              <CalendarDays aria-hidden="true" />
              Browse events
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  const LocationIcon = event.mode === "online" ? Monitor : MapPin;
  const location = event.mode === "online" ? "Online event" : event.venue_name ?? "Venue TBA";

  return (
    <Link href={`/member/events/${event.id}`} className="block">
      <Card className="p-4 transition-colors hover:border-brand/40">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-brand">
            <Ticket className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
              Your next event
            </p>
            <h2 className="mt-1 font-heading text-base font-extrabold leading-6 tracking-tight">
              {event.title}
            </h2>
            <div className="mt-2 grid gap-1 text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                {formatEventDateTime(event.starts_at, event.timezone)}
              </span>
              <span className="flex items-center gap-1.5">
                <LocationIcon className="size-3.5" aria-hidden="true" />
                {location}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
