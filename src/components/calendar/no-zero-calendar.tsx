"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  MapPin,
  Sparkles,
  Ticket,
  Trophy,
  Users,
  X,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EventType } from "@/lib/database/types";
import type { DayCell, LeaderboardEntry, NoZeroMonth } from "@/lib/calendar/no-zero-month";
import { WeeklyActivityGuide } from "@/components/calendar/weekly-activity-guide";
import { TeamLeaderboard } from "@/components/calendar/team-leaderboard";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

type TypeStyle = {
  label: string;
  dot: string; // small swatch (legend + day modal)
  solid: string; // filled cell background
  border: string; // dashed cell border
  text: string; // dashed cell text
};

const TYPE_META: Record<EventType, TypeStyle> = {
  presentation: { label: "Presentation", dot: "bg-info", solid: "bg-info", border: "border-info", text: "text-info" },
  business: { label: "Business", dot: "bg-info", solid: "bg-info", border: "border-info", text: "text-info" },
  training: { label: "Training", dot: "bg-success", solid: "bg-success", border: "border-success", text: "text-success" },
  sizzle: { label: "Special", dot: "bg-gold-dark", solid: "bg-gold-dark", border: "border-gold-dark", text: "text-gold-dark" },
  mentoring: { label: "Mentoring", dot: "bg-gold-dark", solid: "bg-gold-dark", border: "border-gold-dark", text: "text-gold-dark" },
  fellowship: { label: "Fellowship", dot: "bg-gold-dark", solid: "bg-gold-dark", border: "border-gold-dark", text: "text-gold-dark" },
  other: { label: "Event", dot: "bg-muted-foreground", solid: "bg-muted-foreground", border: "border-muted-foreground", text: "text-muted-foreground" },
};

const REG_BADGE: Record<string, { label: string; className: string }> = {
  registered: { label: "Registered", className: "bg-sky-50 text-sky-700" },
  attended: { label: "Attended", className: "bg-emerald-50 text-success" },
  no_show: { label: "No-show", className: "bg-slate-100 text-muted-foreground" },
  converted: { label: "Converted", className: "bg-purple-50 text-purple" },
};

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatLongDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function NoZeroCalendar({
  month,
  todayWeekday,
  leaderboard,
}: {
  month: NoZeroMonth;
  todayWeekday: number;
  leaderboard: LeaderboardEntry[];
}) {
  const [openDay, setOpenDay] = useState<DayCell | null>(null);

  const todayBanner =
    month.todayIsNoZero === null ? null : month.todayIsNoZero ? (
      <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold leading-snug text-emerald-700">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
        <div>
          <b className="font-extrabold">Today is a No-Zero Day.</b> Great work — keep the chain
          alive.
        </div>
      </div>
    ) : (
      <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold leading-snug text-amber-700">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-gold-dark" aria-hidden="true" />
        <div>
          <b className="font-extrabold">Today is still a Zero Day.</b> Sponsor a prospect today to
          make it count.
        </div>
      </div>
    );

  return (
    <div className="grid gap-3">
      {todayBanner}

      {/* Month header + nav */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-bold tracking-tight">My No-Zero Calendar</h2>
        <div className="flex items-center gap-1">
          <Link
            href={`/member/calendar?month=${month.prevYm}`}
            className="flex size-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:bg-secondary"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Link>
          <span className="min-w-[7.5rem] text-center text-xs font-bold text-muted-foreground">
            {month.monthLabel}
          </span>
          <Link
            href={`/member/calendar?month=${month.nextYm}`}
            className="flex size-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:bg-secondary"
            aria-label="Next month"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2.5">
        <SummaryStat value={month.noZeroDays} label="No-Zero days" icon={CheckCircle2} />
        <SummaryStat value={month.currentStreak} label="Day streak" icon={Flame} accent="gold" />
        <SummaryStat value={month.bestStreak} label="Best streak" icon={Trophy} />
      </div>

      {/* Grid */}
      <Card className="p-4">
        <div className="mb-2 grid grid-cols-7 gap-1.5">
          {DOW.map((d, i) => (
            <div
              key={i}
              className="text-center text-[10px] font-extrabold uppercase text-muted-foreground/70"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: month.leadingBlanks }).map((_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {month.cells.map((cell) => (
            <DayButton key={cell.iso} cell={cell} onOpen={() => setOpenDay(cell)} />
          ))}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-border/60 pt-3 text-[11px] font-semibold text-muted-foreground">
          <LegendItem swatch={<span className="size-3 rounded-full bg-brand" />} label="No-Zero day" />
          <LegendItem
            swatch={<span className="size-3 rounded-full border-2 border-dashed border-brand bg-card" />}
            label="Going / RSVP"
          />
          <LegendItem
            swatch={<span className="size-3 rounded-full border border-border bg-secondary" />}
            label="Zero day"
          />
          <LegendItem swatch={<span className="size-2.5 rounded-full bg-info" />} label="Presentation" />
          <LegendItem swatch={<span className="size-2.5 rounded-full bg-success" />} label="Training" />
          <LegendItem swatch={<span className="size-2.5 rounded-full bg-gold-dark" />} label="Special" />
        </div>
      </Card>

      <p className="px-2 text-center text-[11px] leading-5 text-muted-foreground">
        A No-Zero Day = a day you sponsored at least one prospect. Bring a guest to an event — that
        is what makes the day count.
      </p>

      <WeeklyActivityGuide todayWeekday={todayWeekday} />
      <TeamLeaderboard entries={leaderboard} />

      {openDay ? <DayDetailDialog cell={openDay} onClose={() => setOpenDay(null)} /> : null}
    </div>
  );
}

function SummaryStat({
  value,
  label,
  icon: Icon,
  accent,
}: {
  value: number;
  label: string;
  icon: typeof Flame;
  accent?: "gold";
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-secondary/50 p-3 text-center">
      <Icon
        className={cn("mx-auto size-4", accent === "gold" ? "text-gold" : "text-brand")}
        aria-hidden="true"
      />
      <div className="mt-1 font-heading text-2xl font-extrabold leading-none text-brand">
        {value}
      </div>
      <div className="mt-1 text-[10px] font-semibold text-muted-foreground">{label}</div>
    </div>
  );
}

function LegendItem({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {swatch}
      {label}
    </span>
  );
}

function DayButton({ cell, onOpen }: { cell: DayCell; onOpen: () => void }) {
  const base =
    "mx-auto flex size-9 items-center justify-center text-[12.5px] font-bold transition-colors";

  // The event type that drives the cell colour (first event of the day, if any).
  const meta = cell.events[0] ? TYPE_META[cell.events[0].type] ?? TYPE_META.other : null;

  let styles: string;
  if (cell.status === "done") {
    // A day that counts: solid fill, coloured by its event type (brand-blue if it
    // was a prospect-only No-Zero day with no event).
    styles = cn("rounded-[10px] text-white", meta ? meta.solid : "bg-brand");
  } else if (cell.status === "going") {
    // Upcoming RSVP: dashed outline in the event-type colour.
    styles = cn(
      "rounded-full border-2 border-dashed bg-card",
      meta ? cn(meta.border, meta.text) : "border-brand text-brand",
    );
  } else {
    styles = cn(
      "rounded-full border border-border bg-secondary text-muted-foreground",
      cell.isFuture && "opacity-70",
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${cell.iso}${cell.status === "done" ? " — No-Zero day" : ""}${
        cell.events.length ? ` — ${cell.events.length} event(s)` : ""
      }`}
      className={cn(base, styles, cell.isToday && "cal-today-ring")}
    >
      {cell.day}
    </button>
  );
}

function DayDetailDialog({ cell, onClose }: { cell: DayCell; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Day details"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-5 shadow-xl sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-heading text-base font-black tracking-tight">
              {formatLongDate(cell.iso)}
            </p>
            <span
              className={cn(
                "mt-1 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wide",
                cell.status === "done"
                  ? "bg-emerald-50 text-success"
                  : cell.status === "going"
                    ? "bg-secondary text-brand"
                    : "bg-slate-100 text-muted-foreground",
              )}
            >
              {cell.status === "done" ? (
                <>
                  <CheckCircle2 className="size-3" aria-hidden="true" /> No-Zero day
                </>
              ) : cell.status === "going" ? (
                <>
                  <CalendarDays className="size-3" aria-hidden="true" /> RSVP&apos;d
                </>
              ) : (
                "Zero day"
              )}
            </span>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X aria-hidden="true" />
          </Button>
        </div>

        {/* Prospects sponsored */}
        <section className="mb-4">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
            <Users className="size-3.5" aria-hidden="true" />
            Prospects sponsored
          </h3>
          {cell.prospects.length === 0 ? (
            <p className="text-sm font-semibold text-muted-foreground">
              No prospects sponsored on this day.
            </p>
          ) : (
            <ul className="grid gap-2">
              {cell.prospects.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-secondary/40 px-3 py-2"
                >
                  <span className="truncate text-sm font-bold">{p.fullName}</span>
                  <span className="shrink-0 rounded-lg bg-card px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-brand">
                    {p.stage}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Events */}
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            Your events
          </h3>
          {cell.events.length === 0 ? (
            <p className="text-sm font-semibold text-muted-foreground">
              No events you&apos;re registered for on this day.
            </p>
          ) : (
            <ul className="grid gap-2">
              {cell.events.map((ev) => {
                const meta = TYPE_META[ev.type] ?? TYPE_META.other;
                const badge = ev.registrationStatus
                  ? REG_BADGE[ev.registrationStatus]
                  : undefined;
                return (
                  <li
                    key={ev.id}
                    className="rounded-xl border border-border/70 bg-secondary/40 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn("size-2.5 shrink-0 rounded-full", meta.dot)} />
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">
                        {ev.title}
                      </span>
                      {badge ? (
                        <span
                          className={cn(
                            "shrink-0 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-wide",
                            badge.className,
                          )}
                        >
                          {badge.label}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-[18px] text-xs font-semibold text-muted-foreground">
                      <span>{formatTime(ev.startsAt)}</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" aria-hidden="true" />
                        {ev.mode === "online" ? "Online" : ev.venueName ?? "Venue TBA"}
                      </span>
                      {ev.capacity != null ? <span>{ev.capacity} seats</span> : null}
                    </div>
                    <Link
                      href={`/member/events/${ev.id}`}
                      className="mt-2 inline-flex items-center gap-1.5 pl-[18px] text-xs font-bold text-brand hover:underline"
                    >
                      <Ticket className="size-3.5" aria-hidden="true" />
                      View my pass
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
