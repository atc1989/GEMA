import { CalendarDays, MapPin, Monitor, Ticket } from "lucide-react";

import { PassLookupForm } from "@/components/prospect/pass-lookup-form";
import { QRCodeCard } from "@/components/qr/qr-code-card";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatEventDateTime } from "@/lib/utils/format";
import type { RegistrationStatus } from "@/lib/database/types";

type PassRow = {
  id: string;
  qr_payload: string;
  pass_code: string;
  status: RegistrationStatus;
  attendee_name: string;
  registered_at: string;
  events: {
    id: string;
    title: string;
    starts_at: string;
    timezone: string;
    venue_name: string | null;
    mode: string;
  };
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  registered: { label: "Registered", className: "bg-sky-50 text-sky-700" },
  attended: { label: "Attended", className: "bg-emerald-50 text-success" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive" },
  no_show: { label: "No-show", className: "bg-slate-100 text-muted-foreground" },
  converted: { label: "Converted", className: "bg-purple-50 text-purple" },
};

export default async function PassesPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const trimmedEmail = email?.trim().toLowerCase();

  let passes: PassRow[] = [];
  let lookupError: string | null = null;

  if (trimmedEmail) {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("event_registrations")
      .select(
        "id, qr_payload, pass_code, status, attendee_name, registered_at, events!inner(id, title, starts_at, timezone, venue_name, mode)",
      )
      .eq("attendee_email", trimmedEmail)
      .eq("registration_kind", "prospect")
      .neq("status", "cancelled")
      .order("registered_at", { ascending: false })
      .limit(20)
      .returns<PassRow[]>();

    if (error) {
      lookupError = "Could not retrieve passes. Please try again.";
    } else {
      passes = data ?? [];
    }
  }

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-lg font-black tracking-tight">My Passes</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Enter the email you registered with to view your event QR passes.
        </p>
      </div>

      <Card className="p-4">
        <PassLookupForm defaultEmail={trimmedEmail} />
        {lookupError ? (
          <p className="mt-3 text-sm font-semibold text-destructive">{lookupError}</p>
        ) : null}
      </Card>

      {trimmedEmail && !lookupError ? (
        passes.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title="No passes found"
            description="No registrations found for this email. Make sure you use the same email you registered with."
          />
        ) : (
          <div className="grid gap-6">
            {passes.map((pass) => {
              const ev = pass.events;
              const LocationIcon = ev.mode === "online" ? Monitor : MapPin;
              const location =
                ev.mode === "online" ? "Online event" : ev.venue_name ?? "Venue TBA";
              const badge = STATUS_BADGE[pass.status] ?? STATUS_BADGE.registered;

              return (
                <div key={pass.id} className="grid gap-3">
                  {/* Event header */}
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-brand">
                      <CalendarDays className="size-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold leading-5">{ev.title}</p>
                      <div className="mt-1 grid gap-0.5 text-xs font-semibold text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <CalendarDays className="size-3.5" aria-hidden="true" />
                          {formatEventDateTime(ev.starts_at, ev.timezone)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <LocationIcon className="size-3.5" aria-hidden="true" />
                          {location}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wide ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  {/* QR card */}
                  <QRCodeCard
                    value={pass.qr_payload}
                    code={pass.pass_code}
                    title={`Pass for ${pass.attendee_name}`}
                    description="Show this QR at the check-in desk."
                  />
                </div>
              );
            })}
          </div>
        )
      ) : null}
    </div>
  );
}
