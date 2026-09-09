import { CalendarDays, MapPin, Monitor } from "lucide-react";

import { formatEventDateTime } from "@/lib/utils/format";
import type { EventMode } from "@/lib/database/types";

export type EventWhenWhere = {
  mode: EventMode;
  starts_at: string;
  timezone: string;
  venue_name: string | null;
  venue_address: string | null;
  map_url: string | null;
  online_url: string | null;
};

/** When and where, for the header of a working screen (attendance, scanner). */
export function EventWhenWhere({ event }: { event: EventWhenWhere }) {
  return (
    <div className="mt-2 grid gap-1 text-sm font-medium text-muted-foreground">
      <p className="flex items-center gap-1.5">
        <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
        {formatEventDateTime(event.starts_at, event.timezone)}
      </p>

      {event.mode !== "online" && event.venue_name ? (
        <p className="flex items-start gap-1.5">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {event.map_url ? (
              <a
                href={event.map_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand underline-offset-4 hover:underline"
              >
                {event.venue_name}
              </a>
            ) : (
              event.venue_name
            )}
            {event.venue_address ? (
              <span className="block text-xs">{event.venue_address}</span>
            ) : null}
          </span>
        </p>
      ) : null}

      {event.mode !== "in_person" && event.online_url ? (
        <p className="flex items-center gap-1.5">
          <Monitor className="size-4 shrink-0" aria-hidden="true" />
          <a
            href={event.online_url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-brand underline-offset-4 hover:underline"
          >
            {event.online_url}
          </a>
        </p>
      ) : null}
    </div>
  );
}
