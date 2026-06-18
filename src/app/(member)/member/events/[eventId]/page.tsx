import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, Monitor } from "lucide-react";

import { QRCodeCard } from "@/components/qr/qr-code-card";
import { Card } from "@/components/ui/card";
import { getCurrentMember } from "@/lib/auth/require-member";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatEventDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

type EventRow = {
  id: string;
  title: string;
  starts_at: string;
  timezone: string;
  venue_name: string | null;
  online_url: string | null;
  mode: string;
  status: string;
  description: string | null;
};

type RegistrationRow = {
  id: string;
  qr_payload: string;
  pass_code: string;
  status: string;
  attendee_name: string;
};

const REG_STATUS: Record<string, { label: string; className: string }> = {
  registered: { label: "Registered", className: "bg-sky-50 text-sky-700" },
  attended: { label: "Attended", className: "bg-emerald-50 text-success" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive" },
  no_show: { label: "No-show", className: "bg-slate-100 text-muted-foreground" },
  converted: { label: "Converted", className: "bg-purple-50 text-purple" },
};

export default async function MemberEventPassPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const ctx = await getCurrentMember();
  const member = ctx!.member;

  const supabase = await createSupabaseServerClient();
  const [{ data: event }, { data: registration }] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, starts_at, timezone, venue_name, online_url, mode, status, description")
      .eq("id", eventId)
      .maybeSingle<EventRow>(),
    supabase
      .from("event_registrations")
      .select("id, qr_payload, pass_code, status, attendee_name")
      .eq("event_id", eventId)
      .eq("member_id", member.id)
      .maybeSingle<RegistrationRow>(),
  ]);

  if (!event || !registration) notFound();

  const tone = REG_STATUS[registration.status] ?? REG_STATUS.registered;
  const LocationIcon = event.mode === "online" ? Monitor : MapPin;
  const location =
    event.mode === "online"
      ? event.online_url ?? "Online event"
      : event.venue_name ?? "Venue to be announced";

  return (
    <div className="mx-auto grid max-w-md gap-4">
      <Link
        href="/member/events"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        My events
      </Link>

      <div>
        <h2 className="text-lg font-black tracking-tight">{event.title}</h2>
        <div className="mt-2 grid gap-1 text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            {formatEventDateTime(event.starts_at, event.timezone)}
          </span>
          <span className="flex items-center gap-1.5">
            <LocationIcon className="size-3.5" aria-hidden="true" />
            {location}
          </span>
        </div>
      </div>

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
              tone.className,
            )}
          >
            {tone.label}
          </span>
        </div>
      </Card>
    </div>
  );
}
