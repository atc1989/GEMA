import Link from "next/link";
import { CalendarDays, Stethoscope } from "lucide-react";

import { GinhawaLandingForm } from "@/components/ginhawa/ginhawa-landing-form";
import { GinhawaPublishedBanner } from "@/components/ginhawa/ginhawa-published-banner";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { EventStatusBadge } from "@/components/event/event-status-badge";
import {
  eventToFormValues,
  landingToFormValues,
  mapLandingRow,
  type EventPrefill,
  type GinhawaLandingRow,
  type SpeakerPrefill,
} from "@/lib/ginhawa/prefill";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatEventDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type { EventStatus } from "@/lib/database/types";

type EventPick = {
  id: string;
  title: string;
  starts_at: string;
  timezone: string;
  status: EventStatus;
  venue_name: string | null;
};

export default async function AdminGinhawaPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string }>;
}) {
  const { eventId } = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [{ data: landingRow }, { data: eventRows }] = await Promise.all([
    supabase.from("ginhawa_landing").select("*").eq("id", true).maybeSingle<GinhawaLandingRow>(),
    supabase
      .from("events")
      .select("id, title, starts_at, timezone, status, venue_name")
      .neq("status", "archived")
      .order("starts_at", { ascending: false })
      .limit(50)
      .returns<EventPick[]>(),
  ]);

  const landing = landingRow ? mapLandingRow(landingRow) : null;
  const events = eventRows ?? [];
  const selectedId = eventId || landing?.sourceEventId || null;
  const selectedSummary = events.find((e) => e.id === selectedId) ?? null;

  let formValues = landing ? landingToFormValues(landing) : null;
  let selectedEventTitle = selectedSummary?.title ?? landing?.title ?? "this event";

  if (selectedId) {
    const { data: event } = await supabase
      .from("events")
      .select(
        "id, title, starts_at, timezone, description, capacity, venue_name, venue_address, map_url",
      )
      .eq("id", selectedId)
      .maybeSingle<EventPrefill>();

    const { data: speakers } = await supabase
      .from("event_speakers")
      .select("id, name, role_title, photo_url")
      .eq("event_id", selectedId)
      .order("sort_order", { ascending: true })
      .returns<SpeakerPrefill[]>();

    if (event) {
      selectedEventTitle = event.title;
      const sameAsPublished = landing?.sourceEventId === event.id && !eventId;
      const editingPublishedEvent = landing?.sourceEventId === event.id && Boolean(eventId);
      if (sameAsPublished && landing) {
        formValues = landingToFormValues(landing);
      } else if (editingPublishedEvent && landing) {
        formValues = landingToFormValues({ ...landing, sourceEventId: event.id });
      } else {
        formValues = eventToFormValues(event, speakers ?? [], landing);
      }
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-black tracking-tight">Ginhawa landing</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Pick an event, edit the public copy, then publish. Ginhawa stays a separate site and reads this snapshot.
        </p>
      </div>

      {landing?.published ? (
        <GinhawaPublishedBanner eventTitle={landing.title} publishedAt={landing.publishedAt} />
      ) : null}

      <div>
        <h3 className="mb-2 text-sm font-black tracking-tight">1. Choose an event</h3>
        {events.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No events to pick"
            description="Create and publish an event first, then come back to post it on Ginhawa."
          />
        ) : (
          <div className="grid gap-2">
            {events.map((event) => {
              const selected = event.id === selectedId;
              return (
                <Link
                  key={event.id}
                  href={`/admin/ginhawa?eventId=${event.id}`}
                  className={cn(
                    "block rounded-2xl border px-4 py-3 transition-colors hover:border-brand/40",
                    selected ? "border-brand bg-cream/50" : "border-border/70 bg-card",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{event.title}</p>
                      <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                        {formatEventDateTime(event.starts_at, event.timezone)}
                        {event.venue_name ? ` · ${event.venue_name}` : ""}
                      </p>
                    </div>
                    <EventStatusBadge status={event.status} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {formValues ? (
        <div>
          <h3 className="mb-2 text-sm font-black tracking-tight">2. Edit and publish</h3>
          <GinhawaLandingForm
            key={formValues.sourceEventId}
            defaultValues={formValues}
            eventTitle={selectedEventTitle}
          />
        </div>
      ) : (
        <Card className="flex flex-col items-center px-6 py-8 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-secondary text-brand">
            <Stethoscope className="size-6" aria-hidden="true" />
          </div>
          <h2 className="text-base font-bold tracking-tight">Select an event above</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            We will pull the title, date, details, capacity, venue, and speakers into the form. You can still change every field before publishing.
          </p>
        </Card>
      )}
    </div>
  );
}
