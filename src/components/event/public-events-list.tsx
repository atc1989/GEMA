"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, MapPin, Monitor, Ticket } from "lucide-react";

import { EventFilterBar, matchesSearch } from "@/components/event/event-filter-bar";
import { TYPE_META } from "@/components/event/event-meta";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PagerControls } from "@/components/ui/pager-controls";
import { DEFAULT_PER_PAGE } from "@/components/ui/pagination";
import type { EventType } from "@/lib/database/types";
import { cn } from "@/lib/utils";
import { formatEventDateTime } from "@/lib/utils/format";

export type PublicEventRow = {
  id: string;
  title: string;
  event_type: EventType;
  starts_at: string;
  timezone: string;
  venue_name: string | null;
  mode: string;
  description: string | null;
};

/** Prospect-facing event list with the same instant search + category filter. */
export function PublicEventsList({ events }: { events: PublicEventRow[] }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);

  const filtered = useMemo(
    () =>
      events.filter(
        (e) => (!type || e.event_type === type) && matchesSearch(q, e.title, e.venue_name),
      ),
    [events, q, type],
  );

  // Clamp instead of resetting on filter change: search shrinks the list, so the
  // stale page number just collapses back into range.
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  return (
    <div className="grid gap-3">
      <EventFilterBar q={q} onQ={setQ} type={type} onType={setType} />
      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm font-semibold text-muted-foreground">
          No events match your search or category.
        </p>
      ) : (
        <div className="grid gap-3">
          {visible.map((ev) => {
            const typeMeta = TYPE_META[ev.event_type] ?? TYPE_META.other;
            const LocationIcon = ev.mode === "online" ? Monitor : MapPin;
            const location =
              ev.mode === "online" ? "Online event" : ev.venue_name ?? "Venue TBA";

            return (
              <Card key={ev.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cream text-brand">
                    <CalendarDays className="size-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wide",
                        typeMeta.className,
                      )}
                    >
                      {typeMeta.label}
                    </span>
                    <h3 className="mt-1.5 text-sm font-bold leading-5">{ev.title}</h3>
                    <div className="mt-2 grid gap-1 text-xs font-semibold text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="size-3.5" aria-hidden="true" />
                        {formatEventDateTime(ev.starts_at, ev.timezone)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <LocationIcon className="size-3.5" aria-hidden="true" />
                        {location}
                      </span>
                    </div>
                    {ev.description ? (
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {ev.description}
                      </p>
                    ) : null}
                    <div className="mt-3">
                      <Link
                        href={`/invite/${ev.id}`}
                        className={cn(
                          buttonVariants({ variant: "brand", size: "sm" }),
                          "h-7 text-xs",
                        )}
                      >
                        <Ticket className="size-3.5" aria-hidden="true" />
                        View &amp; register
                      </Link>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <PagerControls
        page={safePage}
        count={filtered.length}
        perPage={perPage}
        onPage={setPage}
        onPerPage={setPerPage}
      />
    </div>
  );
}
