import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CheckCircle2,
  HeartHandshake,
  HeartPulse,
  MessageCircle,
  Pill,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createGutGuardCareRelationshipAction,
  createGutGuardTeamAction,
  deleteGutGuardReminderAction,
  dismissGutGuardJourneyMessageAction,
  recordGutGuardDoseAction,
  saveGutGuardJourneyMessageAction,
  saveGutGuardReminderAction,
} from "@/lib/actions/gutguard-daily";
import {
  GutGuardOnboardingFlow,
  GutGuardReminderSettings,
  GutGuardSupplyPanel,
} from "@/features/gutguard-daily/components/gutguard-member-screens";
import { cn } from "@/lib/utils";
import type {
  AdminOverview,
  CareRelationshipRow,
  DailyDoseRow,
  DosingConfigRow,
  GutGuardDoseStatus,
  JourneyMessageRow,
  OnboardingProgressRow,
  ReminderRow,
  TeamMemberRow,
  TeamRow,
} from "@/features/gutguard-daily/repositories/daily-health-repository";

export type GutGuardPageData = {
  doses: DailyDoseRow[];
  reminders: ReminderRow[];
  onboarding: OnboardingProgressRow | null;
  dosingConfig: DosingConfigRow | null;
  journeyMessages: JourneyMessageRow[];
  careRelationships: CareRelationshipRow[];
  teams: TeamRow[];
  teamMembers: TeamMemberRow[];
  monthLabel: string;
  today: string;
};

const subnav = [
  { href: "/gutguard-daily", label: "Overview", icon: HeartPulse, exact: true },
  { href: "/gutguard-daily/tracker", label: "Tracker", icon: Pill },
  { href: "/gutguard-daily/reminders", label: "Reminders", icon: Bell },
  { href: "/gutguard-daily/onboarding", label: "Onboarding", icon: Sparkles },
  { href: "/gutguard-daily/journey", label: "Journey", icon: MessageCircle },
  { href: "/gutguard-daily/community", label: "Community", icon: Users },
];

const statusTone: Record<GutGuardDoseStatus, string> = {
  scheduled: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  taken: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  skipped: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
  missed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200",
};

function groupDosesByDate(doses: DailyDoseRow[]) {
  return doses.reduce<Record<string, DailyDoseRow[]>>((groups, dose) => {
    groups[dose.dose_date] = [...(groups[dose.dose_date] ?? []), dose];
    return groups;
  }, {});
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function isActivePath(href: string, activePath: string, exact?: boolean) {
  return activePath === href || (!exact && activePath.startsWith(`${href}/`));
}

export function GutGuardSubnav({ activePath }: { activePath: string }) {
  return (
    <nav className="mb-4 overflow-x-auto" aria-label="GutGuard Daily navigation">
      <div className="flex min-w-max gap-2 rounded-2xl border border-border/70 bg-card p-2">
        {subnav.map((item) => (
          <Link
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-muted-foreground transition-colors hover:bg-secondary hover:text-brand",
              isActivePath(item.href, activePath, item.exact) && "bg-secondary text-brand",
            )}
            href={item.href}
            key={item.href}
          >
            <item.icon className="size-4" aria-hidden="true" />
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function GutGuardOverview({ data }: { data: GutGuardPageData }) {
  const taken = data.doses.filter((dose) => dose.status === "taken").length;
  const activeReminders = data.reminders.filter((reminder) => reminder.enabled).length;
  const pendingMessages = data.journeyMessages.filter((message) => message.status === "pending").length;

  return (
    <div className="grid gap-4">
      <HeroCard
        title="GutGuard Daily"
        subtitle={`Your daily GutGuard routine for ${data.monthLabel}, powered by your GEMA account.`}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Pill} label="Dose rows" value={data.doses.length} />
        <StatCard icon={CheckCircle2} label="Taken" value={taken} tone="text-success" />
        <StatCard icon={Bell} label="Active reminders" value={activeReminders} />
        <StatCard icon={MessageCircle} label="Pending messages" value={pendingMessages} tone="text-gold" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <CalendarPanel data={data} />
        <div className="grid gap-4">
          <ReminderPanel reminders={data.reminders.slice(0, 4)} />
          <OnboardingStatus progress={data.onboarding} />
        </div>
      </section>

      <Card className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink href="/gutguard-daily/tracker" icon={Pill} label="Record today’s dose" />
        <QuickLink href="/gutguard-daily/reminders" icon={Bell} label="Manage reminders" />
        <QuickLink href="/gutguard-daily/journey" icon={MessageCircle} label="Plan touchpoints" />
        <QuickLink href="/gutguard-daily/community" icon={Users} label="Open community" />
      </Card>
    </div>
  );
}

export function GutGuardTracker({ data }: { data: GutGuardPageData }) {
  const grouped = groupDosesByDate(data.doses);

  return (
    <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
      <GutGuardSupplyPanel config={data.dosingConfig} today={data.today} />

      <section className="grid gap-3">
        <Card>
          <h2 className="font-heading text-lg font-black">Record dose</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
            Creates or updates the selected day/slot for your signed-in profile.
          </p>
          <form
            action={recordGutGuardDoseAction}
            className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <Field label="Date">
              <Input name="doseDate" type="date" defaultValue={data.today} required />
            </Field>
            <Field label="Slot">
              <Select name="slot" defaultValue="morning">
                <option value="morning">Morning</option>
                <option value="midday">Midday</option>
                <option value="dreams">Dreams</option>
              </Select>
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue="taken">
                <option value="scheduled">Scheduled</option>
                <option value="taken">Taken</option>
                <option value="skipped">Skipped</option>
                <option value="missed">Missed</option>
              </Select>
            </Field>
            <Field label="Capsules">
              <Input name="capsules" type="number" min="0" max="3" defaultValue="1" required />
            </Field>
            <Field className="sm:col-span-2 lg:col-span-3" label="Notes">
              <Textarea name="notes" placeholder="Optional proof, symptom, or helper note" />
            </Field>
            <Button className="self-end" type="submit" variant="brand">
              <Plus aria-hidden="true" />
              Save dose
            </Button>
          </form>
        </Card>
        {data.doses.length ? (
          Object.entries(grouped).map(([date, dayDoses]) => (
            <Card key={date}>
              <h2 className="font-heading text-sm font-extrabold tracking-tight">{date}</h2>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {dayDoses.map((dose) => (
                  <DoseRow dose={dose} key={dose.id} />
                ))}
              </div>
            </Card>
          ))
        ) : (
          <EmptyState
            description="Record your first dose above. Rows are stored in gutguard_daily_doses under your GEMA profile."
            icon={ShieldCheck}
            title="No dose rows found"
          />
        )}
      </section>
    </div>
  );
}

export function GutGuardReminders({ reminders }: { reminders: ReminderRow[] }) {
  const slotReminders = reminders.filter((reminder) => reminder.slot !== null);

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <GutGuardReminderSettings reminders={reminders} />
      <div className="grid content-start gap-4">
        <ReminderForm />
        <section className="grid gap-3">
          {slotReminders.length ? (
            slotReminders.map((reminder) => (
              <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" key={reminder.id}>
                <div>
                  <h2 className="font-heading text-base font-black capitalize">
                    {reminder.slot ?? "General"} · {formatTime(reminder.local_time)}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">
                    {reminder.channel.replace("_", " ")} · {reminder.timezone} ·{" "}
                    {reminder.enabled ? "enabled" : "paused"}
                  </p>
                </div>
                <form action={deleteGutGuardReminderAction}>
                  <input type="hidden" name="id" value={reminder.id} />
                  <Button type="submit" variant="destructive" size="sm">
                    Delete
                  </Button>
                </form>
              </Card>
            ))
          ) : (
            <EmptyState
              description="Slot reminders (Morning Habit, Midday Boost, Sweet Dreams) created here or during onboarding show up in this list."
              icon={Bell}
              title="No slot reminders yet"
            />
          )}
        </section>
      </div>
    </div>
  );
}

export function GutGuardOnboarding({ progress }: { progress: OnboardingProgressRow | null }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <GutGuardOnboardingFlow progress={progress} />
      <OnboardingStatus progress={progress} large />
    </div>
  );
}

export function GutGuardJourney({ messages }: { messages: JourneyMessageRow[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <Card>
        <h2 className="font-heading text-lg font-black">Create touchpoint</h2>
        <form action={saveGutGuardJourneyMessageAction} className="mt-4 grid gap-3">
          <Field label="Protocol day">
            <Input name="protocolDay" type="number" min="0" max="365" placeholder="7" />
          </Field>
          <Field label="Message type">
            <Input name="messageType" defaultValue="daily_check_in" required />
          </Field>
          <Field label="Channel">
            <Select name="channel" defaultValue="in_app">
              <option value="in_app">In app</option>
              <option value="push">Push</option>
              <option value="sms">SMS</option>
              <option value="messenger">Messenger</option>
              <option value="viber">Viber</option>
              <option value="call">Call</option>
            </Select>
          </Field>
          <Field label="Schedule">
            <Input name="scheduledFor" type="datetime-local" />
          </Field>
          <Field label="Message">
            <Textarea name="body" placeholder="How are you feeling after today’s dose?" required />
          </Field>
          <Button type="submit" variant="brand">Save message</Button>
        </form>
      </Card>

      <section className="grid gap-3">
        {messages.length ? (
          messages.map((message) => (
            <Card key={message.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-brand">
                    Day {message.protocol_day ?? "—"} · {message.message_type}
                  </p>
                  <h2 className="mt-1 text-sm font-bold leading-6">{message.body}</h2>
                  <p className="mt-2 text-xs font-semibold text-muted-foreground">
                    {message.channel.replace("_", " ")} · {message.status} ·{" "}
                    {message.scheduled_for ? new Date(message.scheduled_for).toLocaleString() : "unscheduled"}
                  </p>
                </div>
                {message.status !== "dismissed" ? (
                  <form action={dismissGutGuardJourneyMessageAction}>
                    <input type="hidden" name="id" value={message.id} />
                    <Button type="submit" variant="outline" size="sm">Dismiss</Button>
                  </form>
                ) : null}
              </div>
            </Card>
          ))
        ) : (
          <EmptyState
            description="Create touchpoints for follow-ups, reminders, helper nudges, and protocol messages."
            icon={MessageCircle}
            title="No journey messages yet"
          />
        )}
      </section>
    </div>
  );
}

export function GutGuardCommunity({
  careRelationships,
  teams,
  teamMembers,
}: {
  careRelationships: CareRelationshipRow[];
  teams: TeamRow[];
  teamMembers: TeamMemberRow[];
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <div className="grid gap-4">
        <Card>
          <h2 className="font-heading text-lg font-black">Invite caregiver</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
            Enter an existing GEMA profile UUID to create a pending care relationship.
          </p>
          <form action={createGutGuardCareRelationshipAction} className="mt-4 grid gap-3">
            <Field label="Caregiver profile ID">
              <Input name="caregiverId" placeholder="uuid from public.profiles" required />
            </Field>
            <label className="flex items-center gap-2 text-sm font-bold">
              <Checkbox name="canRecordDoses" />
              Can record doses
            </label>
            <label className="flex items-center gap-2 text-sm font-bold">
              <Checkbox name="canManageReminders" />
              Can manage reminders
            </label>
            <Button type="submit" variant="brand">Create relationship</Button>
          </form>
        </Card>

        <Card>
          <h2 className="font-heading text-lg font-black">Create team</h2>
          <form action={createGutGuardTeamAction} className="mt-4 grid gap-3">
            <Field label="Team name">
              <Input name="name" placeholder="North Luzon GutGuard Team" required />
            </Field>
            <Button type="submit" variant="brand">Create team</Button>
          </form>
        </Card>
      </div>

      <section className="grid gap-4">
        <RelationshipList relationships={careRelationships} />
        <TeamList teams={teams} teamMembers={teamMembers} />
      </section>
    </div>
  );
}

export function GutGuardAdminOperations({ overview }: { overview: AdminOverview }) {
  return (
    <div className="grid gap-4">
      <HeroCard
        title="GutGuard operations"
        subtitle="Admin view for GutGuard records, audit activity, and operational health."
      />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={Pill} label="Doses" value={overview.doseCount} />
        <StatCard icon={Bell} label="Reminders" value={overview.reminderCount} />
        <StatCard icon={MessageCircle} label="Messages" value={overview.journeyCount} />
        <StatCard icon={Sparkles} label="Onboarding" value={overview.onboardingCount} />
        <StatCard icon={HeartHandshake} label="Care links" value={overview.careRelationshipCount} />
        <StatCard icon={Users} label="Teams" value={overview.teamCount} />
      </section>
      <Card>
        <h2 className="font-heading text-lg font-black">Recent audit logs</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-xs font-black uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2">When</th>
                <th className="py-2">Action</th>
                <th className="py-2">Table</th>
                <th className="py-2">Record</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {overview.auditLogs.map((log) => (
                <tr key={log.id}>
                  <td className="py-2 font-semibold">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="py-2 font-bold">{log.action}</td>
                  <td className="py-2">{log.table_name}</td>
                  <td className="py-2 text-muted-foreground">{log.record_id ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {overview.auditLogs.length === 0 ? (
            <p className="py-6 text-center text-sm font-semibold text-muted-foreground">
              No audit logs yet.
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function HeroCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-linear-to-br from-brand to-brand-dark text-white shadow-[0_18px_50px_rgb(14_34_73/18%)]">
      <div className="p-5 lg:p-6">
        <p className="text-xs font-black uppercase tracking-widest text-gold">GutGuard Daily</p>
        <h2 className="mt-2 font-heading text-3xl font-black tracking-tight">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-blue-100">{subtitle}</p>
      </div>
    </section>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "text-brand",
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <Card className="p-3 text-center">
      <Icon className={`mx-auto mb-2 size-5 ${tone}`} aria-hidden="true" />
      <div className={`font-heading text-2xl font-black leading-none ${tone}`}>{value}</div>
      <div className="mt-1 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </Card>
  );
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link className={cn(buttonVariants({ variant: "outline" }), "justify-start")} href={href}>
      <Icon aria-hidden="true" />
      {label}
    </Link>
  );
}

type CalendarDayState = "complete" | "partial" | "missed" | "today" | "upcoming" | "idle";

const calendarCellTone: Record<CalendarDayState, string> = {
  complete: "bg-success text-white",
  partial: "border border-gold/60 bg-gold/15 text-foreground",
  missed: "bg-destructive/10 text-destructive",
  today: "border-2 border-brand font-black text-brand",
  upcoming: "bg-secondary/40 text-muted-foreground",
  idle: "bg-secondary/40 text-muted-foreground",
};

const calendarLegend: Array<[CalendarDayState, string]> = [
  ["complete", "Complete"],
  ["partial", "Partial"],
  ["missed", "Missed"],
  ["today", "Today"],
  ["upcoming", "Upcoming"],
];

// ponytail: read-only month view; day drill-down lives on the tracker page.
function CalendarPanel({ data }: { data: GutGuardPageData }) {
  const [year, month, todayDay] = data.today.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const dateOf = (day: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const byDate = groupDosesByDate(data.doses);

  const takenCount = (day: number) =>
    (byDate[dateOf(day)] ?? []).filter((dose) => dose.status === "taken").length;

  const stateOf = (day: number): CalendarDayState => {
    const rows = byDate[dateOf(day)] ?? [];
    const taken = takenCount(day);
    if (rows.length && taken === rows.length) return "complete";
    if (taken > 0) return "partial";
    if (day === todayDay) return "today";
    if (day > todayDay) return "upcoming";
    if (data.dosingConfig && dateOf(day) >= data.dosingConfig.start_date) return "missed";
    return "idle";
  };

  let streak = 0;
  let cursor = takenCount(todayDay) > 0 ? todayDay : todayDay - 1;
  while (cursor >= 1 && takenCount(cursor) > 0) {
    streak += 1;
    cursor -= 1;
  }
  const takenDays = Array.from({ length: todayDay }, (_, i) => i + 1).filter(
    (day) => takenCount(day) > 0,
  ).length;
  const adherence = Math.round((takenDays / todayDay) * 100);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-black">{data.monthLabel}</h2>
        <Link href="/gutguard-daily/tracker" className="text-xs font-black text-brand">Open tracker</Link>
      </div>

      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold text-muted-foreground">
        {calendarLegend.map(([state, label]) => (
          <span className="inline-flex items-center gap-1.5" key={state}>
            <i className={cn("size-2.5 rounded-sm", calendarCellTone[state])} />
            {label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((weekday) => (
          <div className="text-center text-[10px] font-black text-muted-foreground" key={weekday}>
            {weekday}
          </div>
        ))}
        {Array.from({ length: firstWeekday }, (_, index) => (
          <div key={`blank-${index}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const state = stateOf(day);
          const rows = byDate[dateOf(day)] ?? [];
          return (
            <div
              className={cn(
                "relative flex min-h-11 items-center justify-center rounded-lg text-sm font-bold",
                calendarCellTone[state],
              )}
              key={day}
              title={`${data.monthLabel.split(" ")[0]} ${day}: ${state}`}
            >
              {state === "complete" ? (
                <>
                  <span className="absolute left-1 top-0.5 text-[9px] opacity-85">{day}</span>
                  <span className="text-base font-black">✓</span>
                </>
              ) : state === "partial" ? (
                <>
                  <span className="absolute left-1 top-0.5 text-[9px] opacity-85">{day}</span>
                  <span className="text-xs font-black">
                    {takenCount(day)}/{rows.length}
                  </span>
                </>
              ) : (
                day
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <CalendarStat label="Day streak" value={streak} tone="text-success" />
        <CalendarStat label="Days taken" value={takenDays} tone="text-brand" />
        <CalendarStat label="Adherence" value={`${adherence}%`} tone="text-gold" />
      </div>
    </Card>
  );
}

function CalendarStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 px-2 py-3 text-center">
      <div className={cn("font-heading text-xl font-black leading-none", tone)}>{value}</div>
      <div className="mt-1 text-[9px] font-black uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function ReminderPanel({ reminders }: { reminders: ReminderRow[] }) {
  return (
    <Card>
      <h2 className="font-heading text-lg font-black">Reminders</h2>
      <div className="mt-3 grid gap-2">
        {reminders.length ? (
          reminders.map((reminder) => (
            <div className="flex justify-between gap-3 rounded-xl bg-secondary/60 px-3 py-2 text-sm" key={reminder.id}>
              <span className="font-bold capitalize">{reminder.slot ?? "General"}</span>
              <span className="font-heading font-black text-brand">{formatTime(reminder.local_time)}</span>
            </div>
          ))
        ) : (
          <p className="text-sm font-semibold text-muted-foreground">No reminders yet.</p>
        )}
      </div>
    </Card>
  );
}

function OnboardingStatus({
  progress,
  large = false,
}: {
  progress: OnboardingProgressRow | null;
  large?: boolean;
}) {
  const steps = ["profile", "dosing", "reminders", "consent"];
  const completed = new Set(progress?.completed_steps ?? []);
  const count = steps.filter((step) => completed.has(step)).length;

  return (
    <Card className={large ? "min-h-80" : undefined}>
      <h2 className="font-heading text-lg font-black">Onboarding</h2>
      <p className="mt-1 text-sm font-semibold text-muted-foreground">
        Current step: <span className="font-black text-brand">{progress?.current_step ?? "profile"}</span>
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-brand" style={{ width: `${(count / steps.length) * 100}%` }} />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {steps.map((step) => (
          <div className="flex items-center gap-2 rounded-xl border border-border/70 px-3 py-2 text-sm font-bold capitalize" key={step}>
            <span className={cn("size-2.5 rounded-full", completed.has(step) ? "bg-success" : "bg-border")} />
            {step}
          </div>
        ))}
      </div>
      {progress?.completed_at ? (
        <p className="mt-4 text-xs font-semibold text-success">
          Completed {new Date(progress.completed_at).toLocaleString()}
        </p>
      ) : null}
    </Card>
  );
}

function DoseRow({ dose }: { dose: DailyDoseRow }) {
  return (
    <div className="rounded-xl border border-border/70 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="font-heading text-sm font-extrabold capitalize">
          {dose.dose_date} · {dose.slot}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${statusTone[dose.status]}`}>
          {dose.status}
        </span>
      </div>
      <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
        {dose.capsules} capsule{dose.capsules === 1 ? "" : "s"}
        {dose.taken_at ? ` · taken ${new Date(dose.taken_at).toLocaleString()}` : ""}
        {dose.notes ? ` · ${dose.notes}` : ""}
      </p>
    </div>
  );
}

function ReminderForm() {
  return (
    <Card>
      <h2 className="font-heading text-lg font-black">Create reminder</h2>
      <form action={saveGutGuardReminderAction} className="mt-4 grid gap-3">
        <Field label="Slot">
          <Select name="slot" defaultValue="morning">
            <option value="general">General</option>
            <option value="morning">Morning</option>
            <option value="midday">Midday</option>
            <option value="dreams">Dreams</option>
          </Select>
        </Field>
        <Field label="Channel">
          <Select name="channel" defaultValue="in_app">
            <option value="in_app">In app</option>
            <option value="push">Push</option>
            <option value="sms">SMS</option>
            <option value="messenger">Messenger</option>
            <option value="viber">Viber</option>
            <option value="call">Call</option>
          </Select>
        </Field>
        <Field label="Time">
          <Input name="localTime" type="time" defaultValue="08:00" required />
        </Field>
        <Field label="Timezone">
          <Input name="timezone" defaultValue="Asia/Manila" required />
        </Field>
        <label className="flex items-center gap-2 text-sm font-bold">
          <Checkbox name="enabled" defaultChecked />
          Enabled
        </label>
        <Button type="submit" variant="brand">Save reminder</Button>
      </form>
    </Card>
  );
}

function RelationshipList({ relationships }: { relationships: CareRelationshipRow[] }) {
  return (
    <Card>
      <h2 className="font-heading text-lg font-black">Care relationships</h2>
      <div className="mt-3 grid gap-2">
        {relationships.length ? (
          relationships.map((relationship) => (
            <div className="rounded-xl border border-border/70 px-3 py-2 text-sm" key={relationship.id}>
              <p className="font-bold">Caregiver {relationship.caregiver_id}</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                {relationship.status} · view doses {relationship.can_view_doses ? "yes" : "no"} · record doses{" "}
                {relationship.can_record_doses ? "yes" : "no"}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm font-semibold text-muted-foreground">No care relationships yet.</p>
        )}
      </div>
    </Card>
  );
}

function TeamList({ teams, teamMembers }: { teams: TeamRow[]; teamMembers: TeamMemberRow[] }) {
  return (
    <Card>
      <h2 className="font-heading text-lg font-black">Teams</h2>
      <div className="mt-3 grid gap-2">
        {teams.length ? (
          teams.map((team) => (
            <div className="rounded-xl border border-border/70 px-3 py-2 text-sm" key={team.id}>
              <p className="font-bold">{team.name}</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                {teamMembers.filter((member) => member.team_id === team.id).length} active members
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm font-semibold text-muted-foreground">No teams yet.</p>
        )}
      </div>
    </Card>
  );
}
