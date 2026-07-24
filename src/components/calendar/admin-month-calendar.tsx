"use client";

import { useState } from "react";
import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

import { EventListItem } from "@/components/event/event-list-item";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AdminDayCell, AdminMonth } from "@/lib/calendar/admin-month";
import type { EventType } from "@/lib/database/types";

const TYPE_CIRCLE: Record<EventType, { solid: string; border: string; text: string }> = {
  presentation: { solid: "bg-info", border: "border-info", text: "text-info" },
  business: { solid: "bg-info", border: "border-info", text: "text-info" },
  training: { solid: "bg-success", border: "border-success", text: "text-success" },
  sizzle: { solid: "bg-gold-dark", border: "border-gold-dark", text: "text-gold-dark" },
  mentoring: { solid: "bg-gold-dark", border: "border-gold-dark", text: "text-gold-dark" },
  fellowship: { solid: "bg-gold-dark", border: "border-gold-dark", text: "text-gold-dark" },
  other: { solid: "bg-muted-foreground", border: "border-muted-foreground", text: "text-muted-foreground" },
};

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

function formatLongDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function AdminMonthCalendar({ month }: { month: AdminMonth }) {
  const [openDay, setOpenDay] = useState<AdminDayCell | null>(null);

  return (
    <>
      <Card className="p-2.5 min-[380px]:p-3 min-[420px]:p-4">
        <div className="mb-3 grid gap-2 min-[420px]:flex min-[420px]:items-center min-[420px]:justify-between">
          <h2 className="font-heading text-sm font-bold tracking-tight">{month.monthLabel}</h2>
          <div className="flex items-center gap-1">
            <Link
              href={`/admin/calendar?month=${month.prevYm}`}
              className="flex size-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:bg-secondary"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href={`/admin/calendar?month=${month.nextYm}`}
              className="flex size-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:bg-secondary"
              aria-label="Next month"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

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
            <DayCell key={cell.iso} cell={cell} onOpen={() => setOpenDay(cell)} />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-border/60 pt-3 text-[10.5px] font-semibold text-muted-foreground">
          <LegendItem swatch={<span className="size-3 rounded-full bg-brand" />} label="Published" />
          <LegendItem
            swatch={<span className="size-3 rounded-full border-2 border-dashed border-gold-dark bg-card" />}
            label="Pending approval"
          />
          <LegendItem
            swatch={<span className="size-3 rounded-full border border-border bg-secondary" />}
            label="No events"
          />
        </div>
      </Card>
      <DayEventsDialog cell={openDay} onClose={() => setOpenDay(null)} />
    </>
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

function DayCell({ cell, onOpen }: { cell: AdminDayCell; onOpen: () => void }) {
  const circle =
    "flex size-8 items-center justify-center text-xs font-bold transition-colors min-[420px]:size-9 min-[420px]:text-[12.5px]";

  if (cell.events.length === 0) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${cell.iso} - no events`}
        className={cn(
          "mx-auto rounded-full border border-border bg-secondary text-muted-foreground",
          circle,
          cell.isToday && "cal-today-ring",
        )}
      >
        {cell.day}
      </button>
    );
  }

  const hasDraft = cell.events.some((e) => e.status === "draft");
  const primary = cell.events.find((e) => e.status === "draft") ?? cell.events[0];
  const meta = TYPE_CIRCLE[primary.eventType] ?? TYPE_CIRCLE.other;

  const styles = hasDraft
    ? cn("rounded-full border-2 border-dashed bg-card", meta.border, meta.text)
    : cn("rounded-[10px] text-white", meta.solid);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${cell.iso} - ${cell.events.length} event(s)${hasDraft ? ", pending approval" : ""}`}
      className={cn("mx-auto", circle, styles, cell.isToday && "cal-today-ring")}
    >
      {cell.day}
    </button>
  );
}

function DayEventsDialog({ cell, onClose }: { cell: AdminDayCell | null; onClose: () => void }) {
  return (
    <Dialog.Root
      open={cell !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-3xl bg-card shadow-xl outline-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[80vh] sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
          {cell ? (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
                <div>
                  <Dialog.Title className="font-heading text-base font-black tracking-tight">
                    {formatLongDate(cell.iso)}
                  </Dialog.Title>
                  <p className="mt-1 text-xs font-bold text-muted-foreground">
                    {cell.events.length === 1 ? "1 event" : `${cell.events.length} events`}
                  </p>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
                  <X aria-hidden="true" />
                </Button>
              </div>
              <div className="overflow-y-auto px-5 py-4">
                {cell.events.length === 0 ? (
                  <div className="grid gap-2 py-8 text-center">
                    <CalendarDays
                      className="mx-auto size-6 text-muted-foreground/50"
                      aria-hidden="true"
                    />
                    <p className="text-sm font-bold text-muted-foreground">
                      No events scheduled for this date.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {cell.events.map((event) => (
                      <EventListItem key={event.id} event={event} />
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
