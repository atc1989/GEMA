import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { GinhawaPublishedBanner } from "@/components/ginhawa/ginhawa-published-banner";
import { EventStatusBadge } from "@/components/event/event-status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkSpinner } from "@/components/ui/link-pending";
import { mapLandingRow, type GinhawaLandingRow } from "@/lib/ginhawa/prefill";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatEventDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type { EventStatus } from "@/lib/database/types";

type EventPickRow = {
  id: string;
  title: string;
  starts_at: string;
  timezone: string;
  status: EventStatus;
  venue_name: string | null;
};

export default async function AdminGinhawaPage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: landingRow }, { data: eventRows }] = await Promise.all([
    supabase.from("ginhawa_landing").select("*").eq("id", true).maybeSingle<GinhawaLandingRow>(),
    supabase
      .from("events")
      .select("id, title, starts_at, timezone, status, venue_name")
      .neq("status", "archived")
      .order("starts_at", { ascending: false })
      .limit(50)
      .returns<EventPickRow[]>(),
  ]);

  const landing = landingRow ? mapLandingRow(landingRow) : null;
  const events = eventRows ?? [];

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-black tracking-tight">Ginhawa landing</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Pick an event, edit the public copy, then publish. Ginhawa stays a separate site and reads
          this snapshot.
        </p>
      </div>

      {landing?.published ? (
        <GinhawaPublishedBanner
          eventTitle={landing.title}
          publishedAt={landing.publishedAt}
          editHref={`/admin/ginhawa/${landing.sourceEventId}`}
        />
      ) : null}

      <div>
        <h3 className="mb-2 text-sm font-black tracking-tight">Choose an event</h3>
        {events.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No events to pick"
            description="Create and publish an event first, then come back to post it on Ginhawa."
          />
        ) : (
          <div className="grid gap-2">
            {events.map((event) => {
              const live = landing?.published && landing.sourceEventId === event.id;
              return (
                <Link
                  key={event.id}
                  href={`/admin/ginhawa/${event.id}`}
                  className={cn(
                    "block rounded-2xl border px-4 py-3 transition-colors hover:border-brand/40",
                    live ? "border-brand bg-cream/50" : "border-border/70 bg-card",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{event.title}</p>
                      <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                        {formatEventDateTime(event.starts_at, event.timezone)}
                        {event.venue_name ? ` · ${event.venue_name}` : ""}
                        {live ? " · live on Ginhawa" : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <LinkSpinner className="size-4 text-brand" />
                      <EventStatusBadge status={event.status} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
