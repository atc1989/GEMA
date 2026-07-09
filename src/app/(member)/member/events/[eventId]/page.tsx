import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import {
  EventInviteDetails,
  type InviteSpeaker,
} from "@/components/event/event-invite-details";
import { MemberRsvpButton } from "@/components/event/member-rsvp-button";
import { QRCodeCard } from "@/components/qr/qr-code-card";
import { Card } from "@/components/ui/card";
import { getCurrentMember } from "@/lib/auth/require-member";
import { mapEventRow, type EventRow } from "@/lib/database/mappers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type RegistrationRow = {
  id: string;
  qr_payload: string;
  pass_code: string;
  status: string;
  attendee_name: string;
};

type SpeakerRow = {
  id: string;
  name: string;
  role_title: string | null;
  photo_url: string | null;
};

const REG_STATUS: Record<string, { label: string; className: string }> = {
  registered: { label: "Registered", className: "bg-sky-50 text-sky-700" },
  attended: { label: "Attended", className: "bg-emerald-50 text-success" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive" },
  no_show: { label: "No-show", className: "bg-slate-100 text-muted-foreground" },
  converted: { label: "Converted", className: "bg-purple-50 text-purple" },
};

/**
 * Member-side event page: full event details inside the member shell, with the
 * QR pass when registered and an in-place RSVP when not. Members never get
 * routed through the public prospect invite/registration flow.
 */
export default async function MemberEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const ctx = await getCurrentMember();
  const member = ctx!.member;

  const supabase = await createSupabaseServerClient();
  const [{ data: row }, { data: registration }, { data: speakerRows }, regCount] =
    await Promise.all([
      supabase.from("events").select("*").eq("id", eventId).maybeSingle<EventRow>(),
      supabase
        .from("event_registrations")
        .select("id, qr_payload, pass_code, status, attendee_name")
        .eq("event_id", eventId)
        .eq("member_id", member.id)
        .neq("status", "cancelled")
        .maybeSingle<RegistrationRow>(),
      supabase
        .from("event_speakers")
        .select("id, name, role_title, photo_url")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })
        .returns<SpeakerRow[]>(),
      supabase
        .from("event_registrations")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .neq("status", "cancelled"),
    ]);

  if (!row) notFound();
  const event = mapEventRow(row);

  const speakers: InviteSpeaker[] = (speakerRows ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    roleTitle: s.role_title,
    photoUrl: s.photo_url,
  }));

  const isFull =
    event.capacity != null && (regCount.count ?? 0) >= event.capacity;
  const canRsvp =
    event.visibility === "public" && event.status === "published" && !isFull;
  const tone = registration
    ? REG_STATUS[registration.status] ?? REG_STATUS.registered
    : null;

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <Link
        href="/member/events"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        My events
      </Link>

      {registration ? (
        <>
          <QRCodeCard
            value={registration.qr_payload}
            code={registration.pass_code}
            title="Your event pass"
            description="Show this QR code at the check-in desk."
          />

          <Card className="grid gap-3 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-muted-foreground">Attendee</span>
              <span className="font-bold">{registration.attendee_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-muted-foreground">Pass code</span>
              <span className="font-mono font-bold">{registration.pass_code}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-muted-foreground">Status</span>
              <span
                className={cn(
                  "rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wide",
                  tone!.className,
                )}
              >
                {tone!.label}
              </span>
            </div>
          </Card>
        </>
      ) : (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-bold">You&apos;re not registered yet</p>
            <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
              Reserve a seat to get your QR pass for check-in.
            </p>
          </div>
          <MemberRsvpButton
            eventId={eventId}
            disabled={!canRsvp}
            disabledLabel={
              event.visibility !== "public"
                ? "Invite-only"
                : isFull
                  ? "Full"
                  : "Unavailable"
            }
          />
        </Card>
      )}

      <EventInviteDetails event={event} speakers={speakers} />
    </div>
  );
}
