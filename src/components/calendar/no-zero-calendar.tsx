"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
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
import type {
  DayAttendee,
  DayCell,
  DayStatus,
  LeaderboardEntry,
  NoZeroMonth,
} from "@/lib/calendar/no-zero-month";
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

/** True at Tailwind's lg breakpoint and up; false on first render until mounted. */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
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
  const isDesktop = useIsDesktop();

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
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-5">
      <div className="grid min-w-0 gap-3">
      {todayBanner}

      {/* Month header + nav */}
      <div className="grid gap-2 min-[420px]:flex min-[420px]:items-center min-[420px]:justify-between">
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
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
        <SummaryStat value={month.noZeroDays} label="No-Zero days" icon={CheckCircle2} />
        <SummaryStat value={month.currentStreak} label="Day streak" icon={Flame} accent="gold" />
        <SummaryStat value={month.bestStreak} label="Best streak" icon={Trophy} />
      </div>

      {/* Grid */}
      <Card className="p-2.5 min-[380px]:p-3 min-[420px]:p-4">
        <div className="mb-2 grid grid-cols-7 gap-1">
          {DOW.map((d, i) => (
            <div
              key={i}
              className="text-center text-[10px] font-extrabold uppercase text-muted-foreground/70"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 min-[380px]:gap-1.5">
          {Array.from({ length: month.leadingBlanks }).map((_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {month.cells.map((cell) => (
            <DayButton key={cell.iso} cell={cell} onOpen={() => setOpenDay(cell)} />
          ))}
        </div>

        {/* Legend */}
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border/60 pt-3 text-[10.5px] font-semibold text-muted-foreground min-[420px]:flex min-[420px]:flex-wrap min-[420px]:gap-x-4 min-[420px]:text-[11px]">
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
      </div>

      {/* Desktop: persistent day panel beside the grid */}
      <Card className="sticky top-6 hidden max-h-[calc(100dvh-3rem)] flex-col overflow-hidden p-0 lg:flex">
        {openDay ? (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
              <div>
                <p className="font-heading text-base font-black tracking-tight">
                  {formatLongDate(openDay.iso)}
                </p>
                <DayStatusBadge status={openDay.status} />
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setOpenDay(null)}
                aria-label="Close day details"
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              <DayDetailBody cell={openDay} />
            </div>
          </>
        ) : (
          <div className="grid gap-2 px-5 py-12 text-center">
            <CalendarDays
              className="mx-auto size-6 text-muted-foreground/50"
              aria-hidden="true"
            />
            <p className="text-sm font-bold text-muted-foreground">
              Select a day on the calendar to see its details.
            </p>
          </div>
        )}
      </Card>

      {/* Mobile / tablet: bottom-sheet dialog */}
      {!isDesktop ? <DayDetailDialog cell={openDay} onClose={() => setOpenDay(null)} /> : null}
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
    <div className="min-w-0 rounded-xl border border-border/70 bg-secondary/50 px-1.5 py-2 text-center sm:p-3">
      <Icon
        className={cn("mx-auto size-3.5 sm:size-4", accent === "gold" ? "text-gold" : "text-brand")}
        aria-hidden="true"
      />
      <div className="mt-1 font-heading text-xl font-extrabold leading-none text-brand sm:text-2xl">
        {value}
      </div>
      <div className="mt-1 text-[9.5px] font-semibold leading-tight text-muted-foreground sm:text-[10px]">{label}</div>
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
  const circle =
    "flex size-8 items-center justify-center text-xs font-bold transition-colors min-[420px]:size-9 min-[420px]:text-[12.5px]";

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
  } else if (meta) {
    // Day with events the member hasn't RSVP'd to: solid outline in the type colour.
    styles = cn("rounded-full border-2 bg-card", meta.border, meta.text);
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
      className={cn("mx-auto", circle, styles, cell.isToday && "cal-today-ring")}
    >
      {cell.day}
    </button>
  );
}

const ATTENDEE_GROUPS = [
  { kind: "member", label: "Members attended" },
  { kind: "prospect", label: "Prospects attended" },
] as const;

const ATTENDEE_PREVIEW = 9;

const attendeeChip =
  "inline-block rounded-lg border border-border/60 bg-card px-2 py-1 text-[11px] font-semibold";

function AttendeeGroup({
  label,
  attendees,
}: {
  label: string;
  attendees: DayAttendee[];
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? attendees : attendees.slice(0, ATTENDEE_PREVIEW);
  const hidden = attendees.length - visible.length;

  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
        {label} ({attendees.length})
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {visible.map((a, i) => (
          <li key={`${a.name}-${i}`}>
            {a.prospectId ? (
              <Link
                href={`/member/prospects?focus=${a.prospectId}`}
                className={cn(attendeeChip, "text-brand hover:border-brand/50 hover:underline")}
              >
                {a.name}
              </Link>
            ) : (
              <span className={attendeeChip}>{a.name}</span>
            )}
          </li>
        ))}
        {hidden > 0 || showAll ? (
          <li>
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="rounded-lg bg-secondary px-2 py-1 text-[11px] font-black text-brand hover:bg-secondary/70"
            >
              {showAll ? "Show less" : `+${hidden} more`}
            </button>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function EventAttendees({ attendees }: { attendees: DayAttendee[] }) {
  if (attendees.length === 0) return null;

  return (
    <div className="mt-2.5 grid gap-2.5 border-t border-border/60 pt-2.5 sm:pl-[18px]">
      {ATTENDEE_GROUPS.map(({ kind, label }) => {
        const group = attendees.filter((a) => a.kind === kind);
        if (group.length === 0) return null;
        return <AttendeeGroup key={kind} label={label} attendees={group} />;
      })}
    </div>
  );
}

function DayStatusBadge({ status }: { status: DayStatus }) {
  return (
    <span
      className={cn(
        "mt-1 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wide",
        status === "done"
          ? "bg-emerald-50 text-success"
          : status === "going"
            ? "bg-secondary text-brand"
            : "bg-slate-100 text-muted-foreground",
      )}
    >
      {status === "done" ? (
        <>
          <CheckCircle2 className="size-3" aria-hidden="true" /> No-Zero day
        </>
      ) : status === "going" ? (
        <>
          <CalendarDays className="size-3" aria-hidden="true" /> RSVP&apos;d
        </>
      ) : (
        "Zero day"
      )}
    </span>
  );
}

/** Shared day content: why the day counted + the per-event listings. */
function DayDetailBody({ cell }: { cell: DayCell }) {
  return (
    <>
      {/* Why the day counted */}
      {cell.prospects.length > 0 ? (
          <p className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-700">
            <Users className="size-4 shrink-0 text-success" aria-hidden="true" />
            You sponsored {cell.prospects.length}{" "}
            {cell.prospects.length === 1 ? "prospect" : "prospects"} this day.
          </p>
        ) : null}

        {/* Events */}
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            Events this day
          </h3>
          {cell.events.length === 0 ? (
            <p className="text-sm font-semibold text-muted-foreground">
              No events on this day.
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
                    <EventAttendees attendees={ev.attendees} />
                    <Link
                      href={`/member/events/${ev.id}`}
                      className="mt-2 inline-flex items-center gap-1.5 pl-[18px] text-xs font-bold text-brand hover:underline"
                    >
                      <Ticket className="size-3.5" aria-hidden="true" />
                      {ev.registrationStatus ? "View my pass" : "View & RSVP"}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
    </>
  );
}

function DayDetailDialog({ cell, onClose }: { cell: DayCell | null; onClose: () => void }) {
  return (
    <Dialog.Root
      open={cell !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-3xl bg-card shadow-xl outline-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[80vh] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
          {cell ? (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
                <div>
                  <Dialog.Title className="font-heading text-base font-black tracking-tight">
                    {formatLongDate(cell.iso)}
                  </Dialog.Title>
                  <DayStatusBadge status={cell.status} />
                </div>
                <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
                  <X aria-hidden="true" />
                </Button>
              </div>
              <div className="overflow-y-auto px-5 py-4">
                <DayDetailBody cell={cell} />
              </div>
            </>
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
