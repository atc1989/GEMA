import Link from "next/link";
import { CalendarDays, MapPin, Monitor, Users } from "lucide-react";

import { EventStatusBadge } from "@/components/event/event-status-badge";
import { VISIBILITY_META } from "@/components/event/event-meta";
import { Card } from "@/components/ui/card";
import { LinkSpinner } from "@/components/ui/link-pending";
import { formatEventDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type { Event } from "@/lib/database/types";

export function EventListItem({ event, href }: { event: Event; href?: string }) {
  const locationLabel =
    event.mode === "online"
      ? "Online event"
      : event.venueName ?? "Venue to be announced";
  const LocationIcon = event.mode === "online" ? Monitor : MapPin;
  const isDraft = event.status === "draft";

  return (
    <Link href={href ?? `/admin/events/${event.id}`} className="block">
      <Card
        className={cn(
          "p-4 transition-colors hover:border-brand/40",
          isDraft && "border-2 border-dashed border-gold-dark/70 bg-card",
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cream text-brand">
            <CalendarDays className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h2 className="min-w-0 flex-1 text-sm font-bold leading-5">
                {event.title}
              </h2>
              <LinkSpinner className="size-4 shrink-0 text-brand" />
              <EventStatusBadge status={event.status} />
            </div>
            <div className="mt-2 grid gap-1 text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                {formatEventDateTime(event.startsAt, event.timezone)}
              </span>
              <span className="flex items-center gap-1.5">
                <LocationIcon className="size-3.5" aria-hidden="true" />
                {locationLabel}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3 text-xs font-bold text-muted-foreground">
              <span className="capitalize">{event.eventType}</span>
              <span aria-hidden="true">·</span>
              <span>{VISIBILITY_META[event.visibility].label}</span>
              {event.capacity ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-1.5">
                    <Users className="size-3.5" aria-hidden="true" />
                    {event.capacity} cap
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
