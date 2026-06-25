import Link from "next/link";
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Download,
  MapPin,
  Monitor,
  Pencil,
  QrCode,
  Search,
  Ticket,
  Users,
} from "lucide-react";

import { MemberRsvpButton } from "@/components/event/member-rsvp-button";
import { QRCodeCard } from "@/components/qr/qr-code-card";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireMember } from "@/lib/auth/require-member";
import type {
  EventMode,
  EventStatus,
  EventType,
  EventVisibility,
  RegistrationStatus,
} from "@/lib/database/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { formatEventDateTime } from "@/lib/utils/format";

type HostedEventRow = {
  id: string;
  title: string;
  event_type: EventType;
  status: EventStatus;
  mode: EventMode;
  starts_at: string;
  timezone: string;
  venue_name: string | null;
};

type EventsTab = "all" | "mine" | "passes" | "hosting";

type MemberEventCardRow = {
  id: string;
  title: string;
  event_type: EventType;
  visibility: EventVisibility;
  mode: EventMode;
  status: EventStatus;
  starts_at: string;
  timezone: string;
  venue_name: string | null;
  online_url: string | null;
  capacity: number | null;
  description: string | null;
  speaker_name: string | null;
  registered_count: number;
  member_registration_id: string | null;
  member_registration_status: RegistrationStatus | null;
  member_pass_code: string | null;
  member_qr_payload: string | null;
};

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
    label: "Hosting",
    description: "Events you created and host.",
  },
];

const TYPE_META: Record<EventType, { label: string; className: string }> = {
  presentation: { label: "Presentation", className: "bg-sky-50 text-sky-700" },
  business: { label: "Business", className: "bg-sky-50 text-sky-700" },
  training: { label: "Training", className: "bg-emerald-50 text-success" },
  sizzle: { label: "Special", className: "bg-amber-50 text-gold-dark" },
  mentoring: { label: "Mentoring", className: "bg-amber-50 text-gold-dark" },
  fellowship: { label: "Fellowship", className: "bg-amber-50 text-gold-dark" },
  other: { label: "Event", className: "bg-slate-100 text-muted-foreground" },
};

const REG_STATUS: Record<RegistrationStatus, { label: string; className: string }> = {
  registered: { label: "Registered", className: "bg-sky-50 text-sky-700" },
  attended: { label: "Attended", className: "bg-emerald-50 text-success" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive" },
  no_show: { label: "No-show", className: "bg-slate-100 text-muted-foreground" },
  converted: { label: "Converted", className: "bg-purple-50 text-purple" },
};

function normalizeTab(tab?: string): EventsTab {
  if (tab === "mine" || tab === "passes" || tab === "hosting") return tab;
  return "all";
}

function tabHref(tab: EventsTab, search: string) {
  const params = new URLSearchParams({ tab });
  if (tab === "all" && search) params.set("q", search);
  return `/member/events?${params.toString()}`;
}

export default async function MemberEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const params = await searchParams;
  const activeTab = normalizeTab(params.tab);
  const search = params.q?.trim() ?? "";

  const ctx = await requireMember();
  const supabase = await createSupabaseServerClient();

  const [eventCardsRes, registrationsRes, hostedEventsRes] = await Promise.all([
    activeTab === "all"
      ? supabase
          .rpc("get_member_event_cards", {
            p_search: search || null,
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
  const hostedEvents  = hostedEventsRes.data ?? [];

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
              href={tabHref(tab.key, search)}
              className={cn(
                "rounded-lg px-2 py-2 text-center text-[11px] font-black transition-colors sm:text-xs",
                activeTab === tab.key
                  ? "bg-background text-brand shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <p className="px-1 text-xs font-semibold text-muted-foreground">
          {TABS.find((tab) => tab.key === activeTab)?.description}
        </p>
      </div>

      {activeTab === "all" ? (
        <AllEventsSection
          events={eventCards}
          error={eventCardsRes.error?.message ?? null}
          search={search}
        />
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
        />
      )}
    </div>
  );
}

function AllEventsSection({
  events,
  error,
  search,
}: {
  events: MemberEventCardRow[];
  error: string | null;
  search: string;
}) {
  return (
    <section className="grid gap-3">
      <form action="/member/events" className="relative">
        <input type="hidden" name="tab" value="all" />
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          name="q"
          defaultValue={search}
          placeholder="Search events or venues"
          className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm font-semibold outline-none transition-colors placeholder:text-muted-foreground focus:border-brand"
        />
      </form>

      {error ? (
        <p className="text-sm font-semibold text-destructive">Failed to load events: {error}</p>
      ) : events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={search ? "No matching events" : "No upcoming events"}
          description={
            search
              ? "Try a different event title or venue."
              : "Published events will appear here once they are available."
          }
        />
      ) : (
        <div className="grid gap-3">
          {events.map((event) => (
            <AllEventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </section>
  );
}

function AllEventCard({ event }: { event: MemberEventCardRow }) {
  const typeMeta = TYPE_META[event.event_type] ?? TYPE_META.other;
  const LocationIcon = event.mode === "online" ? Monitor : MapPin;
  const location = event.mode === "online" ? "Online event" : event.venue_name ?? "Venue TBA";
  const seatsLeft = event.capacity == null ? null : Math.max(event.capacity - event.registered_count, 0);
  const isFull = seatsLeft === 0;
  const isRegistered = Boolean(event.member_registration_id);
  const registrationTone = event.member_registration_status
    ? REG_STATUS[event.member_registration_status]
    : null;
  const canRsvp = event.visibility === "public" && !isFull && !isRegistered;

  return (
    <Card className="p-4 transition-colors hover:border-brand/40">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cream text-brand">
          <CalendarDays className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wide",
                typeMeta.className,
              )}
            >
              {typeMeta.label}
            </span>
            <span className="rounded-lg bg-secondary px-2 py-1 text-[10px] font-black uppercase tracking-wide text-brand">
              {event.visibility === "public" ? "Public" : "Invite-only"}
            </span>
            {registrationTone ? (
              <span
                className={cn(
                  "rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wide",
                  registrationTone.className,
                )}
              >
                {registrationTone.label}
              </span>
            ) : null}
          </div>

          <h3 className="mt-2 text-sm font-black leading-5">{event.title}</h3>

          <div className="mt-2 grid gap-1 text-xs font-semibold text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              {formatEventDateTime(event.starts_at, event.timezone)}
            </span>
            <span className="flex items-center gap-1.5">
              <LocationIcon className="size-3.5" aria-hidden="true" />
              {location}
            </span>
            {event.speaker_name ? (
              <span className="flex items-center gap-1.5">
                <Users className="size-3.5" aria-hidden="true" />
                {event.speaker_name}
              </span>
            ) : null}
          </div>

          {event.description ? (
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {event.description}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-bold text-muted-foreground">
              {event.capacity == null ? (
                <span>Open seating</span>
              ) : (
                <span>
                  {seatsLeft} left - {event.registered_count}/{event.capacity} registered
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/invite/${event.id}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                View details
              </Link>
              {isRegistered ? (
                <Link
                  href={`/member/events/${event.id}`}
                  className={cn(buttonVariants({ variant: "brand", size: "sm" }))}
                >
                  <QrCode aria-hidden="true" />
                  View pass
                </Link>
              ) : (
                <MemberRsvpButton
                  eventId={event.id}
                  disabled={!canRsvp}
                  disabledLabel={
                    event.visibility !== "public" ? "Invite-only" : isFull ? "Full" : "Unavailable"
                  }
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
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

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft:     { label: "Draft",     className: "bg-secondary text-brand" },
  published: { label: "Published", className: "bg-emerald-50 text-success" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive" },
  completed: { label: "Completed", className: "bg-slate-100 text-muted-foreground" },
  archived:  { label: "Archived",  className: "bg-slate-100 text-muted-foreground" },
};

function HostingSection({
  events,
  error,
}: {
  events: HostedEventRow[];
  error: string | null;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Your hosted events
        </p>
        <Link
          href="/member/events/new"
          className={cn(buttonVariants({ variant: "brand", size: "sm" }))}
        >
          <CalendarPlus className="size-4" aria-hidden="true" />
          Create event
        </Link>
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
        <div className="grid gap-3">
          {events.map((event) => {
            const badge = STATUS_BADGE[event.status] ?? STATUS_BADGE.draft!;
            const LocationIcon = event.mode === "online" ? Monitor : MapPin;
            const location = event.mode === "online" ? "Online event" : event.venue_name ?? "Venue TBA";
            return (
              <Card key={event.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-brand">
                    <CalendarDays className="size-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wide",
                          badge.className,
                        )}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <h3 className="mt-1.5 text-sm font-black leading-5">{event.title}</h3>
                    <div className="mt-1.5 grid gap-0.5 text-xs font-semibold text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="size-3.5" aria-hidden="true" />
                        {formatEventDateTime(event.starts_at, event.timezone)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <LocationIcon className="size-3.5" aria-hidden="true" />
                        {location}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`/member/events/${event.id}/banner`}
                        className={cn(buttonVariants({ variant: "brand", size: "sm" }))}
                      >
                        <Download className="size-4" aria-hidden="true" />
                        Get banner
                      </Link>
                      <Link
                        href={`/member/events/${event.id}/edit`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                        Edit
                      </Link>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
