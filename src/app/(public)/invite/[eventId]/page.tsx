import Link from "next/link";
import { CalendarX, Gift, Ticket } from "lucide-react";

import { EventInviteDetails, type InviteSpeaker } from "@/components/event/event-invite-details";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { mapEventRow, type EventRow } from "@/lib/database/mappers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type SpeakerRow = {
  id: string;
  name: string;
  role_title: string | null;
  photo_url: string | null;
};

export default async function InviteLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const { eventId } = await params;
  const { ref } = await searchParams;

  const supabase = await createSupabaseServerClient();

  // RLS returns the row only when it is published + public.
  const { data: row } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle<EventRow>();

  if (!row) {
    return (
      <EmptyState
        icon={CalendarX}
        title="Invite not available"
        description="This event isn't open for registration, or the link is no longer valid."
      />
    );
  }

  const event = mapEventRow(row);

  const [{ data: speakerRows }, inviter] = await Promise.all([
    supabase
      .from("event_speakers")
      .select("id, name, role_title, photo_url")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true })
      .returns<SpeakerRow[]>(),
    ref
      ? supabase
          .rpc("resolve_invite_referral", { p_ref_code: ref })
          .then(({ data }) => data as { valid: boolean; inviter_name: string | null } | null)
      : Promise.resolve(null),
  ]);

  const speakers: InviteSpeaker[] = (speakerRows ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    roleTitle: s.role_title,
    photoUrl: s.photo_url,
  }));

  const registerHref = ref
    ? `/register/${eventId}?ref=${encodeURIComponent(ref)}`
    : `/register/${eventId}`;

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      {inviter?.valid && inviter.inviter_name ? (
        <Card className="flex items-center gap-3 border-purple-100 bg-purple-50/60 p-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple">
            <Gift className="size-4" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold">
            You were invited by{" "}
            <span className="font-black">{inviter.inviter_name}</span>.
          </p>
        </Card>
      ) : null}

      <EventInviteDetails event={event} speakers={speakers} />

      <div className="sticky bottom-20 lg:bottom-4">
        <Link
          href={registerHref}
          className={cn(buttonVariants({ variant: "brand", size: "lg" }), "w-full shadow-lg")}
        >
          <Ticket aria-hidden="true" />
          Reserve my seat
        </Link>
      </div>
    </div>
  );
}
