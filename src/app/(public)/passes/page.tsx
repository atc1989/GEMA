import Link from "next/link";
import { CalendarDays, Gift, MapPin, Monitor, Ticket } from "lucide-react";

import { PassLookupForm } from "@/components/prospect/pass-lookup-form";
import { QRCodeCard } from "@/components/qr/qr-code-card";
import { LeadReferralCard } from "@/components/referral/lead-referral-card";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PaginatedList } from "@/components/ui/paginated-list";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatEventDateTime } from "@/lib/utils/format";
import { escapeIlike, phoneVariants } from "@/lib/utils/phone";
import type { RegistrationStatus } from "@/lib/database/types";

type PassRow = {
  id: string;
  qr_payload: string;
  pass_code: string;
  status: RegistrationStatus;
  attendee_name: string;
  registered_at: string;
  prospect_id: string | null;
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
  searchParams: Promise<{ q?: string; email?: string; name?: string }>;
}) {
  const params = await searchParams;
  // `email` kept for old bookmarked links.
  const query = (params.q ?? params.email)?.trim();
  const name = params.name?.trim();

  let passes: PassRow[] = [];
  let lookupError: string | null = null;
  // Set once they've attended something — attending is what makes a prospect a
  // "lead", which is what entitles them to a referral link.
  let leadProspectId: string | null = null;
  let leadRefCode: string | null = null;

  // Both name + credential required: an email/phone alone can be shared across
  // registrations (group signups, reused numbers) and would leak others' passes.
  if (query && name) {
    const supabase = createSupabaseAdminClient();
    let dbQuery = supabase
      .from("event_registrations")
      .select(
        "id, qr_payload, pass_code, status, attendee_name, registered_at, prospect_id, events!inner(id, title, starts_at, timezone, venue_name, mode)",
      )
      .eq("registration_kind", "prospect")
      .neq("status", "cancelled")
      // Escape ilike wildcards so "%" in the input can't match everything.
      .ilike("attendee_name", escapeIlike(name))
      .order("registered_at", { ascending: false })
      .limit(100);

    dbQuery = query.includes("@")
      ? dbQuery.eq("attendee_email", query.toLowerCase())
      : dbQuery.in("attendee_phone", phoneVariants(query));

    const { data, error } = await dbQuery.returns<PassRow[]>();

    if (error) {
      lookupError = "Could not retrieve passes. Please try again.";
    } else {
      passes = data ?? [];
      leadProspectId = passes.find((p) => p.status === "attended")?.prospect_id ?? null;

      if (leadProspectId) {
        const { data: referral } = await supabase
          .from("referrals")
          .select("ref_code")
          .eq("referrer_prospect_id", leadProspectId)
          .limit(1)
          .maybeSingle<{ ref_code: string }>();
        leadRefCode = referral?.ref_code ?? null;
      }
    }
  }

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-lg font-black tracking-tight">My Passes</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Enter your full name and the email or mobile number you registered with to view
          your event QR passes.
        </p>
      </div>

      <Card className="p-4">
        <PassLookupForm defaultQuery={query} defaultName={name} />
        {lookupError ? (
          <p className="mt-3 text-sm font-semibold text-destructive">{lookupError}</p>
        ) : null}
        {/* An existing Guild member doesn't need this lookup at all — signing in
            provisions their member account (provisionOneGrindersLogin), which
            has their passes, referrals, and earnings in one place. */}
        <p className="mt-4 border-t border-border/60 pt-3 text-xs font-semibold text-muted-foreground">
          Already a One Grinders Guild member?{" "}
          <Link href="/login" className="font-bold text-brand hover:underline">
            Sign in
          </Link>{" "}
          with your Guild username and password instead.
        </p>
      </Card>

      {leadProspectId && query && name ? (
        <Card className="p-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-brand">
              <Gift className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-black">Your referral link</p>
              <p className="text-xs font-semibold text-muted-foreground">
                You've attended an event — share this and anyone who registers through it
                is credited to you.
              </p>
            </div>
          </div>
          <LeadReferralCard initialRefCode={leadRefCode} name={name} query={query} />
        </Card>
      ) : null}

      {query && name && !lookupError ? (
        passes.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title="No passes found"
            description="No registrations found. Make sure you use the same full name and email or mobile number you registered with."
          />
        ) : (
          <PaginatedList as="div" className="grid gap-6">
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
          </PaginatedList>
        )
      ) : null}
    </div>
  );
}
