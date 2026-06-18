import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DashboardCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  helper?: string;
  tone?: "brand" | "success" | "gold" | "purple";
};

const toneClass = {
  brand: "bg-secondary text-brand",
  success: "bg-emerald-50 text-success",
  gold: "bg-amber-50 text-gold",
  purple: "bg-purple-50 text-purple",
};

export function DashboardCard({
  icon: Icon,
  label,
  value,
  helper,
  tone = "brand",
}: DashboardCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            toneClass[tone],
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="font-heading text-[11px] font-bold text-muted-foreground">{label}</div>
          <div className="font-heading mt-0.5 text-[22px] font-extrabold leading-tight tracking-tight">
            {value}
          </div>
          {helper ? (
            <div className="mt-1 text-xs font-medium text-muted-foreground">{helper}</div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
