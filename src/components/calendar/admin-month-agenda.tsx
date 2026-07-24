"use client";

import { useMemo, useState } from "react";
import { CalendarX } from "lucide-react";

import { EventFilterBar, matchesSearch } from "@/components/event/event-filter-bar";
import { VISIBILITY_META } from "@/components/event/event-meta";
import { EventListItem } from "@/components/event/event-list-item";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { Event, EventStatus, EventVisibility } from "@/lib/database/types";

const STATUS_TABS: { key: EventStatus | ""; label: string }[] = [
  { key: "", label: "All" },
  { key: "draft", label: "Pending" },
  { key: "published", label: "Published" },
  { key: "cancelled", label: "Cancelled" },
  { key: "completed", label: "Completed" },
  { key: "archived", label: "Archived" },
];

const VISIBILITY_TABS: { key: EventVisibility | ""; label: string }[] = [
  { key: "public", label: VISIBILITY_META.public.label },
  { key: "private", label: VISIBILITY_META.private.label },
  { key: "company_support", label: "Company Events" },
  { key: "", label: "All" },
];

function dayHeading(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

/** Client-side filtered agenda for one month's events, grouped by day. Filtering
 * runs over the already-fetched month payload — a single month is always a
 * small set, so no extra query/pagination is needed. */
export function AdminMonthAgenda({ events }: { events: Event[] }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState<EventStatus | "">("");
  const [visibility, setVisibility] = useState<EventVisibility | "">("");

  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          (!type || e.eventType === type) &&
          (!status || e.status === status) &&
          (!visibility || e.visibility === visibility) &&
          matchesSearch(q, e.title, e.venueName),
      ),
    [events, q, type, status, visibility],
  );

  const groups = useMemo(() => {
    const byDay = new Map<string, Event[]>();
    for (const e of filtered) {
      const key = e.startsAt.slice(0, 10);
      const list = byDay.get(key) ?? [];
      list.push(e);
      byDay.set(key, list);
    }
    return Array.from(byDay.entries());
  }, [filtered]);

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <EventFilterBar q={q} onQ={setQ} type={type} onType={setType} />
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted p-1">
          {VISIBILITY_TABS.map((tab) => (
            <button
              key={tab.key || "all-visibility"}
              type="button"
              onClick={() => setVisibility(tab.key)}
              className={cn(
                "flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-center text-[11px] font-black transition-colors sm:text-xs",
                visibility === tab.key
                  ? "bg-brand text-brand-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatus(tab.key)}
              className={cn(
                "flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-center text-[11px] font-black transition-colors sm:text-xs",
                status === tab.key
                  ? "bg-brand text-brand-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={CalendarX}
          title="No events match"
          description="Nothing this month fits the current filters."
        />
      ) : (
        <div className="grid gap-4">
          {groups.map(([iso, dayEvents]) => (
            <div key={iso} id={iso} className="grid gap-2 scroll-mt-4">
              <h3 className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                {dayHeading(iso)}
              </h3>
              <div className="grid gap-2">
                {dayEvents.map((event) => (
                  <EventListItem key={event.id} event={event} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
