import { Flame, Trophy } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { NoZeroResult } from "@/lib/no-zero";

export function NoZeroStreak({ currentStreak, bestStreak, isActiveToday }: NoZeroResult) {
  const isOnStreak = currentStreak > 0;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            isActiveToday ? "bg-amber-50 text-amber-500" : "bg-slate-100 text-muted-foreground",
          )}
        >
          <Flame className="size-5" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-heading text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            No-Zero Streak
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="font-heading text-[22px] font-extrabold leading-tight tracking-tight">
              {currentStreak}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              day{currentStreak !== 1 ? "s" : ""} in a row
            </span>
          </div>
          {!isActiveToday ? (
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
              {isOnStreak
                ? "Sponsor a prospect today to keep your streak."
                : "Sponsor your first prospect today to start."}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wide",
              isActiveToday ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-muted-foreground",
            )}
          >
            <Flame className="size-3" aria-hidden="true" />
            {isActiveToday ? "Active today" : "Pending"}
          </span>
          {bestStreak > 0 ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
              <Trophy className="size-3" aria-hidden="true" />
              Best: {bestStreak}
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
