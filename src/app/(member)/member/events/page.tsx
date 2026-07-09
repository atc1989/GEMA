import Link from "next/link";
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  MapPin,
  Monitor,
  QrCode,
  Ticket,
} from "lucide-react";

import { QRCodeCard } from "@/components/qr/qr-code-card";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkSpinner } from "@/components/ui/link-pending";
import { requireMember } from "@/lib/auth/require-member";
import type { EventMode, EventStatus, EventType, RegistrationStatus } from "@/lib/database/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { formatEventDateTime } from "@/lib/utils/format";

import { REG_STATUS, type HostedEventRow, type MemberEventCardRow } from "./event-meta";
import { AllEventsList, HostedEventsList } from "./events-lists";

type EventsTab = "all" | "mine" | "passes" | "hosting";

type RegistrationRow = {
  id: string;
  status: RegistrationStatus;
  pass_code: string;
  qr_payload: string;
  attendee_name: string;
  registered_at: string;
  events: {
    id: string;
    title: string;
    event_type: EventType;
    starts_at: string;
    timezone: string;
    venue_name: string | null;
    online_url: string | null;
    mode: EventMode;
    status: EventStatus;
  };
};

const TABS: { key: EventsTab; label: string; description: string }[] = [
  {
    key: "all",
    label: "All Events",
    description: "Browse upcoming Gutguard events and RSVP with one tap.",
  },
  {
    key: "mine",
    label: "My RSVPs",
    description: "Events you are registered for.",
  },
  {
    key: "passes",
    label: "My Passes",
    description: "QR passes ready for check-in.",
  },
  {
    key: "hosting",
    label: "My Events",
    description: "Events you created and host.",
  },
];

function normalizeTab(tab?: string): EventsTab {
  if (tab === "mine" || tab === "passes" || tab === "hosting") return tab;
  return "all";
}

export default async function MemberEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const activeTab = normalizeTab(params.tab);

  const ctx = await requireMember();
  const supabase = await createSupabaseServerClient();

  const [eventCardsRes, registrationsRes, hostedEventsRes] = await Promise.all([
    activeTab === "all"
      ? supabase
          .rpc("get_member_event_cards", {
            p_search: null,
            p_limit: 50,
          })
          .returns<MemberEventCardRow[]>()
      : Promise.resolve({ data: [] as MemberEventCardRow[], error: null }),
    activeTab === "mine" || activeTab === "passes"
      ? supabase
          .from("event_registrations")
          .select(
            "id, status, pass_code, qr_payload, attendee_name, registered_at, events!inner(id, title, event_type, starts_at, timezone, venue_name, online_url, mode, status)",
          )
          .eq("member_id", ctx.member.id)
          .neq("status", "cancelled")
          .order("registered_at", { ascending: false })
          .returns<RegistrationRow[]>()
      : Promise.resolve({ data: [] as RegistrationRow[], error: null }),
    activeTab === "hosting"
      ? supabase
          .from("events")
          .select("id, title, event_type, status, mode, starts_at, timezone, venue_name")
          .eq("host_member_id", ctx.member.id)
          .order("starts_at", { ascending: false })
          .limit(50)
          .returns<HostedEventRow[]>()
      : Promise.resolve({ data: [] as HostedEventRow[], error: null }),
  ]);

  const eventCards = Array.isArray(eventCardsRes.data)
    ? (eventCardsRes.data as MemberEventCardRow[])
    : [];
  const registrations = registrationsRes.data ?? [];
  const hostedEvents = hostedEventsRes.data ?? [];

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-black tracking-tight">Events</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Browse events, manage your RSVPs, and keep your QR passes ready.
        </p>
      </div>

      <div className="grid gap-3">
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={`/member/events?tab=${tab.key}`}
              className={cn(
                "rounded-lg px-2 py-2 text-center text-[11px] font-black transition-colors sm:text-xs",
                activeTab === tab.key
                  ? "bg-background text-brand shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="inline-flex items-center justify-center gap-1">
                {tab.label}
                <LinkSpinner className="size-3" />
              </span>
            </Link>
          ))}
        </div>
        <p className="px-1 text-xs font-semibold text-muted-foreground">
          {TABS.find((tab) => tab.key === activeTab)?.description}
        </p>
      </div>

      {activeTab === "all" ? (
        <AllEventsSection events={eventCards} error={eventCardsRes.error?.message ?? null} />
      ) : activeTab === "mine" ? (
        <MyEventsSection
          registrations={registrations}
          error={registrationsRes.error?.message ?? null}
        />
      ) : activeTab === "passes" ? (
        <MyPassesSection
          registrations={registrations}
          error={registrationsRes.error?.message ?? null}
        />
      ) : (
        <HostingSection
          events={hostedEvents}
          error={hostedEventsRes.error?.message ?? null}
          canPublishEvents={ctx.profile.canPublishEvents}
        />
      )}
    </div>
  );
}

function AllEventsSection({
  events,
  error,
}: {
  events: MemberEventCardRow[];
  error: string | null;
}) {
  if (error) {
    return <p className="text-sm font-semibold text-destructive">Failed to load events: {error}</p>;
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No upcoming events"
        description="Published events will appear here once they are available."
      />
    );
  }

  return <AllEventsList events={events} />;
}

function MyEventsSection({
  registrations,
  error,
}: {
  registrations: RegistrationRow[];
  error: string | null;
}) {
  if (error) {
    return <p className="text-sm font-semibold text-destructive">Failed to load events: {error}</p>;
  }

  if (registrations.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No event registrations yet"
        description="RSVP to a published event and it will appear here."
      />
    );
  }

  return (
    <div className="grid gap-3">
      {registrations.map((registration) => (
        <RegistrationCard key={registration.id} registration={registration} />
      ))}
    </div>
  );
}

function RegistrationCard({ registration }: { registration: RegistrationRow }) {
  const event = registration.events;
  const tone = REG_STATUS[registration.status] ?? REG_STATUS.registered;
  const LocationIcon = event.mode === "online" ? Monitor : MapPin;
  const location =
    event.mode === "online" ? event.online_url ?? "Online event" : event.venue_name ?? "Venue TBA";

  return (
    <Link href={`/member/events/${event.id}`} className="block">
      <Card className="p-4 transition-colors hover:border-brand/40">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cream text-brand">
            <CalendarDays className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="min-w-0 flex-1 text-sm font-bold leading-5">{event.title}</h3>
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
                {formatEventDateTime(event.starts_at, event.timezone)}
              </span>
              <span className="flex items-center gap-1.5">
                <LocationIcon className="size-3.5" aria-hidden="true" />
                {location}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <QrCode className="size-3.5" aria-hidden="true" />
              <span className="font-mono">{registration.pass_code}</span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function MyPassesSection({
  registrations,
  error,
}: {
  registrations: RegistrationRow[];
  error: string | null;
}) {
  if (error) {
    return <p className="text-sm font-semibold text-destructive">Failed to load passes: {error}</p>;
  }

  if (registrations.length === 0) {
    return (
      <EmptyState
        icon={Ticket}
        title="No passes yet"
        description="Your QR passes appear here after you RSVP to an event."
      />
    );
  }

  return (
    <div className="grid gap-5">
      {registrations.map((registration) => {
        const event = registration.events;
        const tone = REG_STATUS[registration.status] ?? REG_STATUS.registered;
        return (
          <div key={registration.id} className="grid gap-3">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-brand">
                <Ticket className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black leading-5">{event.title}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                  {formatEventDateTime(event.starts_at, event.timezone)}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wide",
                  tone.className,
                )}
              >
                {tone.label}
              </span>
            </div>
            <QRCodeCard
              value={registration.qr_payload}
              code={registration.pass_code}
              title={`Pass for ${registration.attendee_name}`}
              description="Show this QR at the check-in desk."
            />
            <Link
              href={`/member/events/${event.id}`}
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            >
              <CheckCircle2 aria-hidden="true" />
              Open pass details
            </Link>
          </div>
        );
      })}
    </div>
  );
}

function HostingSection({
  events,
  error,
  canPublishEvents,
}: {
  events: HostedEventRow[];
  error: string | null;
  canPublishEvents: boolean;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Your hosted events
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span
            className={cn(
              "rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wide",
              canPublishEvents ? "bg-emerald-50 text-success" : "bg-secondary text-brand",
            )}
          >
            {canPublishEvents ? "Direct publishing enabled" : "Admin review required"}
          </span>
          <Link
            href="/member/events/new"
            className={cn(buttonVariants({ variant: "brand", size: "sm" }))}
          >
            <CalendarPlus className="size-4" aria-hidden="true" />
            Create event
          </Link>
        </div>
      </div>

      {error ? (
        <p className="text-sm font-semibold text-destructive">Failed to load: {error}</p>
      ) : events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No hosted events yet"
          description="Create your first event to start sharing banners and inviting prospects."
          className="border-dashed"
        />
      ) : (
        <HostedEventsList events={events} />
      )}
    </section>
  );
}
