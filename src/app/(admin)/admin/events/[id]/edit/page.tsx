import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { EventForm } from "@/components/event/event-form";
import { mapEventRow, type EventRow } from "@/lib/database/mappers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toDateTimeLocalValue } from "@/lib/utils/format";
import type { EventFormInput } from "@/lib/schemas/event";

export default async function EditEventPage({
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

  const defaultValues: Partial<EventFormInput> = {
    title: event.title,
    eventType: event.eventType,
    visibility: event.visibility,
    mode: event.mode,
    startsAt: toDateTimeLocalValue(event.startsAt),
    endsAt: toDateTimeLocalValue(event.endsAt),
    timezone: event.timezone,
    venueName: event.venueName ?? undefined,
    venueAddress: event.venueAddress ?? undefined,
    mapUrl: event.mapUrl ?? undefined,
    onlineUrl: event.onlineUrl ?? undefined,
    capacity: event.capacity ?? undefined,
    description: event.description ?? undefined,
    bannerUrl: event.bannerUrl ?? undefined,
  };

  return (
    <div className="grid gap-4">
      <Link
        href={`/admin/events/${event.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to event
      </Link>
      <div>
        <h2 className="text-lg font-black tracking-tight">Edit event</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Update the details below and save your changes.
        </p>
      </div>
      <EventForm mode="edit" eventId={event.id} defaultValues={defaultValues} />
    </div>
  );
}
