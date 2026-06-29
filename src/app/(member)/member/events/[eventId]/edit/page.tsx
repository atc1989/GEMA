import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { MemberEventForm } from "@/components/event/member-event-form";
import { requireMember } from "@/lib/auth/require-member";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type EventEditRow = {
  id: string;
  title: string;
  event_type: string;
  visibility: string;
  mode: string;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  venue_name: string | null;
  venue_address: string | null;
  map_url: string | null;
  online_url: string | null;
  capacity: number | null;
  description: string | null;
  host_member_id: string | null;
  metadata: Record<string, unknown>;
};

export default async function MemberEditEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const ctx = await requireMember();

  const supabase = await createSupabaseServerClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, title, event_type, visibility, mode, starts_at, ends_at, timezone, venue_name, venue_address, map_url, online_url, capacity, description, host_member_id, metadata")
    .eq("id", eventId)
    .maybeSingle<EventEditRow>();

  if (!event || event.host_member_id !== ctx.member.id) notFound();

  const { data: speaker } = await supabase
    .from("event_speakers")
    .select("name, photo_url")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle<{ name: string; photo_url: string | null }>();

  const selfName = ctx.profile.fullName ?? ctx.profile.email ?? undefined;

  const toLocalDT = (iso: string | null) => {
    if (!iso) return undefined;
    return iso.slice(0, 16); // "YYYY-MM-DDTHH:mm"
  };

  return (
    <div className="grid gap-4">
      <Link
        href="/member/events?tab=hosting"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        My hosted events
      </Link>
      <div>
        <h2 className="text-lg font-black tracking-tight">Edit event</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">{event.title}</p>
      </div>
      <MemberEventForm
        mode="edit"
        eventId={eventId}
        selfName={selfName}
        defaultValues={{
          title: event.title,
          eventType: event.event_type as never,
          visibility: event.visibility as never,
          mode: event.mode as never,
          startsAt: toLocalDT(event.starts_at),
          endsAt: toLocalDT(event.ends_at),
          timezone: event.timezone,
          venueName: event.venue_name ?? undefined,
          venueAddress: event.venue_address ?? undefined,
          mapUrl: event.map_url ?? undefined,
          onlineUrl: event.online_url ?? undefined,
          capacity: event.capacity ?? undefined,
          description: event.description ?? undefined,
          speakerName:
            (event.metadata?.speakerName as string | null) ?? speaker?.name ?? undefined,
          posterTemplate: (event.metadata?.poster_template as string | null) ?? undefined,
          speakerPhotoUrl: speaker?.photo_url ?? undefined,
          photoFocus: event.metadata?.photo_focus as
            | { x: number; y: number; zoom: number }
            | undefined,
        }}
      />
    </div>
  );
}
