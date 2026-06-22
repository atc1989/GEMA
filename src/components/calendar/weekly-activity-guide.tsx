"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  SCHEDULE_BLOCKS,
  WEEKDAY_LETTERS,
  WEEKDAY_NAMES,
  WEEK_GUIDE,
} from "@/lib/calendar/weekly-guide";

export function WeeklyActivityGuide({ todayWeekday }: { todayWeekday: number }) {
  const [open, setOpen] = useState(false);
  const today = WEEK_GUIDE[todayWeekday] ?? WEEK_GUIDE[0]!;
  const TodayIcon = today.icon;

  return (
    <Card className="p-4">
      <h3 className="mb-3 font-heading text-sm font-bold tracking-tight">
        Weekly Activity Guide
      </h3>

      {/* Day strip */}
      <div className="flex gap-1.5">
        {WEEK_GUIDE.map((g, i) => {
          const Icon = g.icon;
          const isToday = i === todayWeekday;
          return (
            <div
              key={i}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-xl border px-1 py-2 text-center",
                isToday
                  ? "border-brand bg-secondary shadow-sm"
                  : "border-border/70 bg-card",
              )}
            >
              <span className="text-[10px] font-extrabold text-muted-foreground">
                {WEEKDAY_LETTERS[i]}
              </span>
              <Icon className={cn("size-4", g.colorClass)} aria-hidden="true" />
              <span className="text-[8.5px] font-bold leading-tight">{g.short}</span>
            </div>
          );
        })}
      </div>

      {/* Today block */}
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/50 p-3">
        <TodayIcon className={cn("size-5 shrink-0", today.colorClass)} aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-heading text-[13px] font-extrabold">
            Today · {WEEKDAY_NAMES[todayWeekday]}
          </p>
          <p className="text-xs font-semibold text-muted-foreground">
            {today.label} · {today.time}
          </p>
        </div>
      </div>

      {/* Expandable schedule */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-3 flex w-full items-center justify-between border-t border-border/60 pt-3 font-heading text-[13px] font-bold text-brand-dark"
      >
        <span>Weekly schedule details</span>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="mt-3 grid gap-2">
          {SCHEDULE_BLOCKS.map((b) => (
            <div
              key={b.when}
              className="rounded-lg border-l-[3px] bg-secondary/40 px-3 py-2"
              style={{ borderLeftColor: b.accent }}
            >
              <p className="font-heading text-xs font-extrabold">{b.when}</p>
              <p className="mt-0.5 text-xs font-semibold leading-snug text-muted-foreground">
                {b.what}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
