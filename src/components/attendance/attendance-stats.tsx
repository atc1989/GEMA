import { CheckCircle2, Percent, Users } from "lucide-react";

import { Card } from "@/components/ui/card";

type AttendanceStatsProps = {
  totalRegistrations: number;
  totalAttendees: number;
};

export function AttendanceStats({
  totalRegistrations,
  totalAttendees,
}: AttendanceStatsProps) {
  const rate =
    totalRegistrations > 0
      ? Math.round((totalAttendees / totalRegistrations) * 100)
      : 0;

  return (
    <section className="grid gap-3 sm:grid-cols-3">
      <Stat
        icon={<Users className="size-5" aria-hidden="true" />}
        tone="bg-secondary text-brand"
        label="Registrations"
        value={String(totalRegistrations)}
      />
      <Stat
        icon={<CheckCircle2 className="size-5" aria-hidden="true" />}
        tone="bg-emerald-50 text-success"
        label="Checked in"
        value={String(totalAttendees)}
      />
      <Stat
        icon={<Percent className="size-5" aria-hidden="true" />}
        tone="bg-amber-50 text-gold"
        label="Attendance rate"
        value={`${rate}%`}
      />
    </section>
  );
}

function Stat({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-black tracking-tight">{value}</div>
        </div>
      </div>
    </Card>
  );
}
