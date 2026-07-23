import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AdminDayCell, AdminMonth } from "@/lib/calendar/admin-month";
import type { EventType } from "@/lib/database/types";

/** Circle styling per event type — kept local (like no-zero-calendar.tsx's own
 * TYPE_META) since it needs solid/border/text variants, not the badge
 * background+text pairing that src/components/event/event-meta.ts's TYPE_META
 * is shaped for. */
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

export function AdminMonthCalendar({ month }: { month: AdminMonth }) {
  return (
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
          <DayCell key={cell.iso} cell={cell} />
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

function DayCell({ cell }: { cell: AdminDayCell }) {
  const circle =
    "flex size-8 items-center justify-center text-xs font-bold transition-colors min-[420px]:size-9 min-[420px]:text-[12.5px]";

  if (cell.events.length === 0) {
    return (
      <div
        className={cn(
          "mx-auto rounded-full border border-border bg-secondary text-muted-foreground",
          circle,
          cell.isToday && "cal-today-ring",
        )}
      >
        {cell.day}
      </div>
    );
  }

  const hasDraft = cell.events.some((e) => e.status === "draft");
  const primary = cell.events.find((e) => e.status === "draft") ?? cell.events[0];
  const meta = TYPE_CIRCLE[primary.eventType] ?? TYPE_CIRCLE.other;

  const styles = hasDraft
    ? cn("rounded-full border-2 border-dashed bg-card", meta.border, meta.text)
    : cn("rounded-[10px] text-white", meta.solid);

  return (
    <a
      href={`#${cell.iso}`}
      aria-label={`${cell.iso} — ${cell.events.length} event(s)${hasDraft ? ", pending approval" : ""}`}
      className={cn("mx-auto", circle, styles, cell.isToday && "cal-today-ring")}
    >
      {cell.day}
    </a>
  );
}
