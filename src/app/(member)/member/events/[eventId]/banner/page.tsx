import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { BannerTemplatePicker } from "@/components/event/banner-template-picker";
import { asPosterTemplateId } from "@/components/event/posters/types";
import { requireMember } from "@/lib/auth/require-member";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EventMode } from "@/lib/database/types";

type BannerEventRow = {
  id: string;
  title: string;
  event_type: string;
  mode: EventMode;
  starts_at: string;
  venue_name: string | null;
  host_member_id: string | null;
  metadata: Record<string, unknown>;
};

export default async function MemberEventBannerPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const ctx = await requireMember();

  const supabase = await createSupabaseServerClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, title, event_type, mode, starts_at, venue_name, host_member_id, metadata")
    .eq("id", eventId)
    .maybeSingle<BannerEventRow>();

  if (!event || event.host_member_id !== ctx.member.id) notFound();

  const { data: speaker } = await supabase
    .from("event_speakers")
    .select("name, photo_url")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle<{ name: string; photo_url: string | null }>();

  const posterData = {
    title: event.title,
    eventType: event.event_type,
    mode: event.mode,
    startsAt: event.starts_at,
    venueName: event.venue_name ?? undefined,
    speakerName: (event.metadata?.speakerName as string | null) ?? speaker?.name ?? undefined,
    speakerPhotoUrl: speaker?.photo_url ?? undefined,
  };

  const initialTemplate = asPosterTemplateId(event.metadata?.poster_template);

  return (
    <div className="mx-auto grid max-w-md gap-4">
      <Link
        href="/member/events?tab=hosting"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        My hosted events
      </Link>

      <div>
        <h2 className="text-lg font-black tracking-tight">Event banner</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Pick a design, then download your 1080 × 1350 poster for social media and Messenger.
        </p>
      </div>

      <BannerTemplatePicker
        data={posterData}
        eventId={eventId}
        initialTemplate={initialTemplate}
      />

      <Link
        href={`/member/events/${eventId}/edit`}
        className="text-center text-xs font-bold text-muted-foreground underline-offset-4 hover:underline"
      >
        Edit event details →
      </Link>
    </div>
  );
}
