import { BadgeCheck, Clock, Wallet } from "lucide-react";

import { Card } from "@/components/ui/card";

function peso(n: number): string {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CommissionStats({
  pendingTotal,
  approvedTotal,
  paidTotal,
}: {
  pendingTotal: number;
  approvedTotal: number;
  paidTotal: number;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      <Stat
        icon={<Clock className="size-5" aria-hidden="true" />}
        tone="bg-slate-100 text-muted-foreground"
        label="Pending"
        value={peso(pendingTotal)}
      />
      <Stat
        icon={<BadgeCheck className="size-5" aria-hidden="true" />}
        tone="bg-sky-50 text-sky-700"
        label="Approved"
        value={peso(approvedTotal)}
      />
      <Stat
        icon={<Wallet className="size-5" aria-hidden="true" />}
        tone="bg-emerald-50 text-success"
        label="Paid"
        value={peso(paidTotal)}
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
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-muted-foreground">{label}</div>
          <div className="mt-1 text-xl font-black tracking-tight tabular-nums">{value}</div>
        </div>
      </div>
    </Card>
  );
}
