import Link from "next/link";
import { CalendarDays, MapPin, Monitor, QrCode } from "lucide-react";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentMember } from "@/lib/auth/require-member";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatEventDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

type RegistrationRow = {
  id: string;
  status: string;
  pass_code: string;
  registered_at: string;
  events: {
    id: string;
    title: string;
    starts_at: string;
    timezone: string;
    venue_name: string | null;
    mode: string;
    status: string;
  };
};

const REG_STATUS: Record<string, { label: string; className: string }> = {
  registered: { label: "Registered", className: "bg-sky-50 text-sky-700" },
  attended: { label: "Attended", className: "bg-emerald-50 text-success" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive" },
  no_show: { label: "No-show", className: "bg-slate-100 text-muted-foreground" },
  converted: { label: "Converted", className: "bg-purple-50 text-purple" },
};

export default async function MemberEventsPage() {
  const ctx = await getCurrentMember();
  const member = ctx!.member;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("event_registrations")
    .select(
      "id, status, pass_code, registered_at, events!inner(id, title, starts_at, timezone, venue_name, mode, status)",
    )
    .eq("member_id", member.id)
    .order("registered_at", { ascending: false })
    .returns<RegistrationRow[]>();

  const rows = data ?? [];

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-black tracking-tight">My Events</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Events you&apos;re registered for. Tap an event to view your QR pass.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No event registrations yet"
          description="Register for an event using a referral link and your pass will appear here."
        />
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => {
            const ev = r.events;
            const tone = REG_STATUS[r.status] ?? REG_STATUS.registered;
            const LocationIcon = ev.mode === "online" ? Monitor : MapPin;
            const location =
              ev.mode === "online" ? "Online event" : ev.venue_name ?? "Venue TBA";

            return (
              <Link key={r.id} href={`/member/events/${ev.id}`} className="block">
                <Card className="p-4 transition-colors hover:border-brand/40">
                  <div className="flex items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cream text-brand">
                      <CalendarDays className="size-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="min-w-0 flex-1 text-sm font-bold leading-5">
                          {ev.title}
                        </h3>
                        <span
                          className={cn(
                            "shrink-0 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wide",
                            tone.className,
                          )}
                        >
                          {tone.label}
                        </span>
                      </div>
                      <div className="mt-2 grid gap-1 text-xs font-semibold text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <CalendarDays className="size-3.5" aria-hidden="true" />
                          {formatEventDateTime(ev.starts_at, ev.timezone)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <LocationIcon className="size-3.5" aria-hidden="true" />
                          {location}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                        <QrCode className="size-3.5" aria-hidden="true" />
                        <span className="font-mono">{r.pass_code}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
