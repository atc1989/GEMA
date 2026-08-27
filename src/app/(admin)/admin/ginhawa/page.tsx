import Link from "next/link";
import { CalendarDays, ExternalLink } from "lucide-react";

import { GinhawaPublishedBanner } from "@/components/ginhawa/ginhawa-published-banner";
import { EventStatusBadge } from "@/components/event/event-status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkSpinner } from "@/components/ui/link-pending";
import { mapLandingRow, type GinhawaLandingRow } from "@/lib/ginhawa/prefill";
import { LANDING_TEMPLATE_META, asLandingTemplate } from "@/lib/ginhawa/templates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatEventDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type { EventStatus } from "@/lib/database/types";

type EventPickRow = {
  id: string;
  title: string;
  slug: string;
  starts_at: string;
  timezone: string;
  status: EventStatus;
  venue_name: string | null;
};

export default async function AdminGinhawaPage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: landingRows }, { data: eventRows }] = await Promise.all([
    supabase
      .from("ginhawa_landing")
      .select("*")
      .order("updated_at", { ascending: false })
      .returns<GinhawaLandingRow[]>(),
    supabase
      .from("events")
      .select("id, title, slug, starts_at, timezone, status, venue_name")
      .neq("status", "archived")
      .order("starts_at", { ascending: false })
      .limit(50)
      .returns<EventPickRow[]>(),
  ]);

  const landings = (landingRows ?? []).map(mapLandingRow);
  const landingByEvent = new Map(landings.map((l) => [l.sourceEventId, l]));
  const published = landings.filter((l) => l.published);
  const events = eventRows ?? [];
  const slugByEvent = new Map(events.map((e) => [e.id, e.slug]));

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-black tracking-tight">Event landings</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Medical, Sizzle, or Session templates. Each event can have its own public page at{" "}
          <span className="font-mono text-xs">/e/[slug]</span>. Publish here to make it live;
          referral links will point to that page.
        </p>
      </div>

      {published.length > 0 ? (
        <div className="grid gap-2">
          {published.map((landing) => {
            const slug = slugByEvent.get(landing.sourceEventId);
            return (
              <GinhawaPublishedBanner
                key={landing.sourceEventId}
                eventTitle={landing.title}
                publishedAt={landing.publishedAt}
                editHref={`/admin/ginhawa/${landing.sourceEventId}`}
                sourceEventId={landing.sourceEventId}
                publicHref={slug ? `/e/${slug}` : undefined}
              />
            );
          })}
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 text-sm font-black tracking-tight">Choose an event</h3>
        {events.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No events to pick"
            description="Create an event first, then come back to add its landing page."
          />
        ) : (
          <div className="grid gap-2">
            {events.map((event) => {
              const landing = landingByEvent.get(event.id);
              const live = Boolean(landing?.published);
              const template = landing
                ? asLandingTemplate(landing.template)
                : null;
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
                        {template
                          ? ` · ${LANDING_TEMPLATE_META[template].label}`
                          : ""}
                        {live ? " · live" : landing ? " · draft" : ""}
                      </p>
                      {landing ? (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-brand">
                          <ExternalLink className="size-3" aria-hidden="true" />
                          {live ? `/e/${event.slug}` : `/e/${event.slug}/preview`}
                        </p>
                      ) : null}
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
