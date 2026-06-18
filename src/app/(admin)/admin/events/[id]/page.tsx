import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  Monitor,
  ScanLine,
  Users,
} from "lucide-react";

import { EventActions } from "@/components/event/event-actions";
import { EventStatusBadge } from "@/components/event/event-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { mapEventRow, type EventRow } from "@/lib/database/mappers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatEventDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle<EventRow>();

  if (error || !data) notFound();
  const event = mapEventRow(data);

  const cancellation = (event.metadata?.cancellation ?? null) as {
    reason?: string;
    at?: string;
  } | null;

  return (
    <div className="grid gap-4">
      <Link
        href="/admin/events"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to events
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black tracking-tight">{event.title}</h2>
            <EventStatusBadge status={event.status} />
          </div>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            <span className="capitalize">{event.eventType}</span> ·{" "}
            <span className="capitalize">{event.visibility}</span> ·{" "}
            <span className="capitalize">{event.mode.replace("_", " ")}</span>
          </p>
        </div>
        <Link
          href={`/admin/events/${event.id}/attendance`}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          <ScanLine aria-hidden="true" />
          Attendance
        </Link>
      </div>

      <EventActions eventId={event.id} status={event.status} />

      {event.status === "cancelled" && cancellation?.reason ? (
        <Card className="border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-bold text-destructive">Event cancelled</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {cancellation.reason}
          </p>
        </Card>
      ) : null}

      <Card className="grid gap-3 p-5">
        <DetailRow icon={CalendarDays} label="Starts">
          {formatEventDateTime(event.startsAt, event.timezone)}
        </DetailRow>
        {event.endsAt ? (
          <DetailRow icon={Clock} label="Ends">
            {formatEventDateTime(event.endsAt, event.timezone)}
          </DetailRow>
        ) : null}
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
            <a
              href={event.onlineUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand underline-offset-4 hover:underline"
            >
              {event.onlineUrl}
            </a>
          </DetailRow>
        ) : null}
        {event.capacity ? (
          <DetailRow icon={Users} label="Capacity">
            {event.capacity}
          </DetailRow>
        ) : null}
      </Card>

      {event.description ? (
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Description
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
            {event.description}
          </p>
        </Card>
      ) : null}
    </div>
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
