import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DashboardCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  helper?: string;
  tone?: "brand" | "success" | "gold" | "purple";
  className?: string;
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
  className,
}: DashboardCardProps) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
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
          <div className="font-heading mt-0.5 break-words text-[22px] font-extrabold leading-tight tracking-tight">
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
