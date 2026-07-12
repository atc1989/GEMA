import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  Monitor,
  Pencil,
  ScanLine,
  Users,
} from "lucide-react";

import { EventActions } from "@/components/event/event-actions";
import { QrDownload } from "@/components/qr/qr-download";
import {
  ScaledPoster,
  type EventPosterData,
} from "@/components/event/event-poster";
import { EventStatusBadge } from "@/components/event/event-status-badge";
import { asPhotoFocus } from "@/components/event/posters/shared";
import { asPosterTemplateId } from "@/components/event/posters/types";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { mapEventRow, type EventRow } from "@/lib/database/mappers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatEventDateTime } from "@/lib/utils/format";
import { slugify } from "@/lib/utils/slug";
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
  const { data: speaker } = await supabase
    .from("event_speakers")
    .select("name, photo_url")
    .eq("event_id", event.id)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle<{ name: string; photo_url: string | null }>();

  const cancellation = (event.metadata?.cancellation ?? null) as {
    reason?: string;
    at?: string;
  } | null;
  const readinessItems = getPublishReadinessItems(event);
  const missingItems = readinessItems.filter((item) => !item.ready);
  const speakerName =
    (event.metadata?.speakerName as string | null) ??
    speaker?.name ??
    undefined;
  const posterData: EventPosterData = {
    title: event.title,
    eventType: event.eventType,
    mode: event.mode,
    startsAt: event.startsAt,
    venueName: event.venueName ?? undefined,
    venueAddress: event.venueAddress ?? undefined,
    speakerName,
    speakerPhotoUrl: speaker?.photo_url ?? undefined,
    photoFocus: asPhotoFocus(event.metadata?.photo_focus),
  };

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
            <h2 className="text-2xl font-black tracking-tight">
              {event.title}
            </h2>
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

      {event.status === "draft" ? (
        <Card className="grid gap-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Publish readiness
              </p>
              <p className="mt-1 text-sm font-semibold">
                {missingItems.length === 0
                  ? "Ready to publish."
                  : `${missingItems.length} item${missingItems.length === 1 ? "" : "s"} needed before publishing.`}
              </p>
            </div>
            <Link
              href={`/admin/events/${event.id}/edit`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <Pencil aria-hidden="true" />
              Edit details
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {readinessItems.map((item) => (
              <div
                key={item.label}
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs font-bold",
                  item.ready
                    ? "border-success/30 bg-success/5 text-success"
                    : "border-destructive/30 bg-destructive/5 text-destructive",
                )}
              >
                {item.label}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

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

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <ScaledPoster
          data={posterData}
          template={asPosterTemplateId(event.metadata?.poster_template)}
          className="rounded-xl border border-border/70 shadow-sm"
        />

        <Card className="flex flex-col gap-4 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Speaker
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-secondary text-brand">
                {speaker?.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={speaker.photo_url}
                    alt={speakerName ?? "Speaker"}
                    className="size-full object-cover"
                  />
                ) : (
                  <Users className="size-6" aria-hidden="true" />
                )}
              </div>
              <div>
                <p className="font-heading text-lg font-black">
                  {speakerName ?? "No speaker set"}
                </p>
                <p className="text-sm font-semibold text-muted-foreground">
                  Used on event posters and invite pages.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col border-t border-border pt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Event QR code
            </p>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Scans to the public invite page. Download for flyers and posters.
            </p>
            <div className="flex flex-1 items-center pt-4">
              <QrDownload
                path={`/invite/${event.id}`}
                fileName={`${slugify(event.title)}-qr`}
                className="w-full"
              />
            </div>
          </div>
        </Card>
      </div>

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

function getPublishReadinessItems(event: ReturnType<typeof mapEventRow>) {
  return [
    { label: "Title", ready: Boolean(event.title.trim()) },
    {
      label: "Future start time",
      ready: Date.parse(event.startsAt) > Date.now(),
    },
    {
      label: "Venue",
      ready: event.mode === "online" || Boolean(event.venueName?.trim()),
    },
    {
      label: "Online URL",
      ready: event.mode === "in_person" || Boolean(event.onlineUrl?.trim()),
    },
    { label: "Description", ready: Boolean(event.description?.trim()) },
  ];
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
