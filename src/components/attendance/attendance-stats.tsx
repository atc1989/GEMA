import { CheckCircle2, Percent, UserCheck, Users } from "lucide-react";

import { Card } from "@/components/ui/card";

type AttendanceStatsProps = {
  totalRegistrations: number;
  membersCheckedIn: number;
  prospectsCheckedIn: number;
};

export function AttendanceStats({
  totalRegistrations,
  membersCheckedIn,
  prospectsCheckedIn,
}: AttendanceStatsProps) {
  const totalAttendees = membersCheckedIn + prospectsCheckedIn;
  const rate =
    totalRegistrations > 0
      ? Math.round((totalAttendees / totalRegistrations) * 100)
      : 0;

  return (
    <section className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 lg:grid-cols-4">
      <Stat
        icon={<Users className="size-5" aria-hidden="true" />}
        tone="bg-secondary text-brand"
        label="Registrations"
        value={String(totalRegistrations)}
      />
      <Stat
        icon={<UserCheck className="size-5" aria-hidden="true" />}
        tone="bg-emerald-50 text-success"
        label="Members checked in"
        value={String(membersCheckedIn)}
      />
      <Stat
        icon={<CheckCircle2 className="size-5" aria-hidden="true" />}
        tone="bg-purple-50 text-purple"
        label="Prospects checked in"
        value={String(prospectsCheckedIn)}
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
    <Card className="min-w-0 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold leading-4 text-muted-foreground">{label}</div>
          <div className="mt-1 break-words text-2xl font-black tracking-tight">{value}</div>
        </div>
      </div>
    </Card>
  );
}
