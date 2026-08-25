"use client";

import { CalendarDays, Loader2, Stethoscope } from "lucide-react";
import { useState, useTransition } from "react";

import { GinhawaLandingForm } from "@/components/ginhawa/ginhawa-landing-form";
import { EventStatusBadge } from "@/components/event/event-status-badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { prefillGinhawaLanding } from "@/lib/actions/ginhawa-landing";
import { landingToFormValues } from "@/lib/ginhawa/prefill";
import type { EventStatus, GinhawaLanding } from "@/lib/database/types";
import type { GinhawaLandingFormInput } from "@/lib/schemas/ginhawa-landing";
import { formatEventDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export type GinhawaEventPick = {
  id: string;
  title: string;
  startsAt: string;
  timezone: string;
  status: EventStatus;
  venueName: string | null;
};

export function GinhawaLandingEditor({
  events,
  landing,
}: {
  events: GinhawaEventPick[];
  landing: GinhawaLanding | null;
}) {
  const initialFromLanding = landing
    ? {
        selectedId: landing.sourceEventId,
        eventTitle: landing.title,
        values: landingToFormValues(landing),
      }
    : null;

  const [selectedId, setSelectedId] = useState<string | null>(initialFromLanding?.selectedId ?? null);
  const [eventTitle, setEventTitle] = useState(initialFromLanding?.eventTitle ?? "");
  const [formValues, setFormValues] = useState<GinhawaLandingFormInput | null>(
    initialFromLanding?.values ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pickEvent = (eventId: string) => {
    setError(null);
    setSelectedId(eventId);
    startTransition(async () => {
      const result = await prefillGinhawaLanding(eventId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEventTitle(result.data.eventTitle);
      setFormValues(result.data.values);
    });
  };

  return (
    <>
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
                <button
                  key={event.id}
                  type="button"
                  onClick={() => pickEvent(event.id)}
                  disabled={pending}
                  className={cn(
                    "block w-full rounded-2xl border px-4 py-3 text-left transition-colors hover:border-brand/40 disabled:opacity-70",
                    selected ? "border-brand bg-cream/50" : "border-border/70 bg-card",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{event.title}</p>
                      <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                        {formatEventDateTime(event.startsAt, event.timezone)}
                        {event.venueName ? ` · ${event.venueName}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {pending && selected ? (
                        <Loader2 className="size-4 animate-spin text-brand" aria-hidden="true" />
                      ) : null}
                      <EventStatusBadge status={event.status} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {error ? <p className="mt-2 text-sm font-semibold text-destructive">{error}</p> : null}
      </div>

      {formValues ? (
        <div>
          <h3 className="mb-2 text-sm font-black tracking-tight">2. Edit and publish</h3>
          <GinhawaLandingForm
            key={formValues.sourceEventId}
            defaultValues={formValues}
            eventTitle={eventTitle}
          />
        </div>
      ) : (
        <Card className="flex flex-col items-center px-6 py-8 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-secondary text-brand">
            <Stethoscope className="size-6" aria-hidden="true" />
          </div>
          <h2 className="text-base font-bold tracking-tight">Select an event above</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            We will pull the title, date, details, capacity, venue, and speakers into the form. You
            can still change every field before publishing.
          </p>
        </Card>
      )}
    </>
  );
}
