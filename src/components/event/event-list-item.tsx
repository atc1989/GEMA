"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, CalendarDays, MapPin, Monitor, Pin, Users } from "lucide-react";

import { EventStatusBadge } from "@/components/event/event-status-badge";
import { VISIBILITY_META } from "@/components/event/event-meta";
import { Card } from "@/components/ui/card";
import { LinkSpinner } from "@/components/ui/link-pending";
import { setEventArchived, toggleEventPin, type ActionResult } from "@/lib/actions/events";
import { formatEventDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type { Event } from "@/lib/database/types";

export function EventListItem({ event, href, creatorName }: { event: Event; href?: string; creatorName?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const locationLabel =
    event.mode === "online"
      ? "Online event"
      : event.venueName ?? "Venue to be announced";
  const LocationIcon = event.mode === "online" ? Monitor : MapPin;
  const isDraft = event.status === "draft";
  const isPinned = Boolean(event.pinnedAt);
  const isArchived = event.status === "archived";

  /** Runs a row action without following the card link, and surfaces failures. */
  const run =
    (action: () => Promise<ActionResult<unknown>>) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setError(null);
      startTransition(async () => {
        const result = await action();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.refresh();
      });
    };

  return (
    <Link href={href ?? `/admin/events/${event.id}`} className="block">
      <Card
        className={cn(
          "p-4 transition-colors hover:border-brand/40",
          isDraft && "border-2 border-dashed border-gold-dark/70 bg-card",
          isPinned && "border-brand/50 bg-cream/40",
          isArchived && "opacity-70",
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
              {isArchived ? null : (
                <button
                  type="button"
                  onClick={run(() => toggleEventPin(event.id, !isPinned))}
                  disabled={pending}
                  aria-pressed={isPinned}
                  title={isPinned ? "Unpin event" : "Pin to top"}
                  className={cn(
                    "shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:text-brand disabled:opacity-50",
                    isPinned && "text-brand",
                  )}
                >
                  <Pin className={cn("size-4", isPinned && "fill-current")} aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={run(() => setEventArchived(event.id, !isArchived))}
                disabled={pending}
                aria-pressed={isArchived}
                title={isArchived ? "Restore event" : "Archive event"}
                className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:text-brand disabled:opacity-50"
              >
                {isArchived ? (
                  <ArchiveRestore className="size-4" aria-hidden="true" />
                ) : (
                  <Archive className="size-4" aria-hidden="true" />
                )}
              </button>
              <EventStatusBadge status={event.status} />
            </div>
            {error ? (
              <p className="mt-1 text-xs font-semibold text-destructive">{error}</p>
            ) : null}
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
              {creatorName ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>by {creatorName}</span>
                </>
              ) : null}
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
