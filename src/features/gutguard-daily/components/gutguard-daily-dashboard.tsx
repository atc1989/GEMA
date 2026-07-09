import { Bell, CalendarDays, CheckCircle2, Pill, ShieldCheck } from "lucide-react";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  DailyDoseRow,
  GutGuardDoseStatus,
  ReminderRow,
} from "@/features/gutguard-daily/repositories/daily-health-repository";

type GutGuardDailyDashboardProps = {
  doses: DailyDoseRow[];
  reminders: ReminderRow[];
  monthLabel: string;
};

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

function formatReminderTime(value: string) {
  return value.slice(0, 5);
}

export function GutGuardDailyDashboard({
  doses,
  reminders,
  monthLabel,
}: GutGuardDailyDashboardProps) {
  const grouped = groupDosesByDate(doses);
  const taken = doses.filter((dose) => dose.status === "taken").length;
  const scheduled = doses.filter((dose) => dose.status === "scheduled").length;

  return (
    <div className="grid gap-4">
      <section className="overflow-hidden rounded-2xl bg-linear-to-br from-brand to-brand-dark text-white shadow-[0_18px_50px_rgb(14_34_73/18%)]">
        <div className="p-5 lg:p-6">
          <p className="text-xs font-black uppercase tracking-widest text-gold">
            GutGuard Daily
          </p>
          <h2 className="mt-2 font-heading text-3xl font-black tracking-tight">
            Database dose tracker
          </h2>
          <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-blue-100">
            Showing real Supabase rows for {monthLabel}. Access is controlled by GEMA login
            and GutGuard RLS.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <StatCard icon={Pill} label="Dose rows" value={doses.length} />
        <StatCard icon={CheckCircle2} label="Taken" value={taken} tone="text-success" />
        <StatCard icon={CalendarDays} label="Scheduled" value={scheduled} />
      </section>

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-secondary text-brand">
            <Bell className="size-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-heading text-sm font-extrabold tracking-tight">Reminders</h2>
            <p className="text-xs font-semibold text-muted-foreground">
              From gutguard_reminders for this signed-in profile.
            </p>
          </div>
        </div>

        {reminders.length ? (
          <div className="grid gap-2">
            {reminders.map((reminder) => (
              <div
                className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2 text-sm"
                key={reminder.id}
              >
                <span className="font-bold capitalize">
                  {reminder.slot ?? "General"} · {reminder.channel.replace("_", " ")}
                </span>
                <span className="font-heading font-black text-brand">
                  {formatReminderTime(reminder.local_time)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm font-semibold leading-6 text-muted-foreground">
            No reminders found for this profile.
          </p>
        )}
      </Card>

      <section className="grid gap-3">
        {doses.length ? (
          Object.entries(grouped).map(([date, dayDoses]) => (
            <Card key={date}>
              <h2 className="font-heading text-sm font-extrabold tracking-tight">{date}</h2>
              <div className="mt-3 grid gap-2">
                {dayDoses.map((dose) => (
                  <div
                    className="rounded-xl border border-border/70 px-3 py-2"
                    key={dose.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-heading text-sm font-extrabold capitalize">
                        {dose.slot}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${statusTone[dose.status]}`}
                      >
                        {dose.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
                      {dose.capsules} capsule{dose.capsules === 1 ? "" : "s"}
                      {dose.taken_at ? ` · taken ${new Date(dose.taken_at).toLocaleString()}` : ""}
                      {dose.notes ? ` · ${dose.notes}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          ))
        ) : (
          <EmptyState
            className="border-0 shadow-none"
            description="The GEMA session is working, but this profile has no gutguard_daily_doses rows in the current month."
            icon={ShieldCheck}
            title="No dose rows found"
          />
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "text-brand",
}: {
  icon: typeof Pill;
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
