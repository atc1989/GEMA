import { CalendarDays, Clock, MapPin, Mic2, Monitor } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatEventDateTime } from "@/lib/utils/format";
import type { Event } from "@/lib/database/types";

export type InviteSpeaker = {
  id: string;
  name: string;
  roleTitle: string | null;
  photoUrl: string | null;
};

export function EventInviteDetails({
  event,
  speakers,
}: {
  event: Event;
  speakers: InviteSpeaker[];
}) {
  return (
    <div className="grid gap-4">
      {event.bannerUrl ? (
        <div className="overflow-hidden rounded-2xl border border-border/70">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.bannerUrl}
            alt={event.title}
            className="aspect-[16/9] w-full object-cover"
          />
        </div>
      ) : null}

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{event.eventType}</Badge>
          <Badge tone="muted">{event.mode.replace("_", " ")}</Badge>
        </div>
        <h1 className="mt-2 text-2xl font-black tracking-tight">{event.title}</h1>
      </div>

      <Card className="grid gap-3 p-5">
        <DetailRow icon={CalendarDays} label="Date & time">
          {formatEventDateTime(event.startsAt, event.timezone)}
          {event.endsAt ? (
            <span className="block text-xs font-medium text-muted-foreground">
              Ends {formatEventDateTime(event.endsAt, event.timezone)}
            </span>
          ) : null}
        </DetailRow>

        {event.mode !== "online" && event.venueName ? (
          <DetailRow icon={MapPin} label="Venue">
            {event.venueName}
            {event.venueAddress ? (
              <span className="block text-xs font-medium text-muted-foreground">
                {event.venueAddress}
              </span>
            ) : null}
          </DetailRow>
        ) : null}

        {event.mode !== "in_person" && event.onlineUrl ? (
          <DetailRow icon={Monitor} label="Online">
            Joining link shared after registration
          </DetailRow>
        ) : null}

        {event.timezone ? (
          <DetailRow icon={Clock} label="Timezone">
            {event.timezone}
          </DetailRow>
        ) : null}
      </Card>

      {event.description ? (
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            About this event
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
            {event.description}
          </p>
        </Card>
      ) : null}

      {speakers.length > 0 ? (
        <Card className="p-5">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <Mic2 className="size-4" aria-hidden="true" />
            Speakers
          </p>
          <ul className="mt-3 grid gap-3">
            {speakers.map((s) => (
              <li key={s.id} className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-black uppercase text-brand">
                  {s.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.photoUrl} alt={s.name} className="size-full object-cover" />
                  ) : (
                    s.name.slice(0, 2)
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{s.name}</p>
                  {s.roleTitle ? (
                    <p className="truncate text-xs font-semibold text-muted-foreground">
                      {s.roleTitle}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function Badge({
  children,
  tone = "brand",
}: {
  children: React.ReactNode;
  tone?: "brand" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wide capitalize",
        tone === "brand" ? "bg-purple-50 text-purple" : "bg-slate-100 text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-brand">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="text-sm font-semibold">{children}</div>
      </div>
    </div>
  );
}
