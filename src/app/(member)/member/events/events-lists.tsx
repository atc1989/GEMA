"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Download,
  MapPin,
  Monitor,
  Pencil,
  QrCode,
  Search,
  UserCheck,
  Users,
} from "lucide-react";

import { MemberRsvpButton } from "@/components/event/member-rsvp-button";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { EventType } from "@/lib/database/types";
import { cn } from "@/lib/utils";
import { formatEventDateTime } from "@/lib/utils/format";

import {
  REG_STATUS,
  STATUS_BADGE,
  TYPE_META,
  type HostedEventRow,
  type MemberEventCardRow,
} from "./event-meta";

/**
 * Client-side event lists with instant filtering: the page fetches the rows
 * once, then search + category filter as you type — no submit, no reload.
 */

function matches(q: string, ...fields: (string | null | undefined)[]) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((f) => f?.toLowerCase().includes(needle));
}

function FilterBar({
  q,
  onQ,
  type,
  onType,
}: {
  q: string;
  onQ: (v: string) => void;
  type: string;
  onType: (v: string) => void;
}) {
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={q}
          onChange={(e) => onQ(e.target.value)}
          placeholder="Search events or venues"
          aria-label="Search events"
          className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm font-semibold outline-none transition-colors placeholder:text-muted-foreground focus:border-brand"
        />
      </div>
      <select
        value={type}
        onChange={(e) => onType(e.target.value)}
        aria-label="Filter by category"
        className="h-11 shrink-0 rounded-xl border border-border bg-card px-3 text-sm font-semibold outline-none transition-colors focus:border-brand"
      >
        <option value="">All categories</option>
        {(Object.keys(TYPE_META) as EventType[]).map((t) => (
          <option key={t} value={t}>
            {TYPE_META[t].label}
          </option>
        ))}
      </select>
    </div>
  );
}

function NoMatches() {
  return (
    <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm font-semibold text-muted-foreground">
      No events match your search or category.
    </p>
  );
}

export function AllEventsList({ events }: { events: MemberEventCardRow[] }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");

  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          (!type || e.event_type === type) &&
          matches(q, e.title, e.venue_name, e.speaker_name),
      ),
    [events, q, type],
  );

  return (
    <section className="grid gap-3">
      <FilterBar q={q} onQ={setQ} type={type} onType={setType} />
      {filtered.length === 0 ? (
        <NoMatches />
      ) : (
        <div className="grid gap-3">
          {filtered.map((event) => (
            <AllEventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </section>
  );
}

export function HostedEventsList({ events }: { events: HostedEventRow[] }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");

  const filtered = useMemo(
    () =>
      events.filter(
        (e) => (!type || e.event_type === type) && matches(q, e.title, e.venue_name),
      ),
    [events, q, type],
  );

  return (
    <div className="grid gap-3">
      <FilterBar q={q} onQ={setQ} type={type} onType={setType} />
      {filtered.length === 0 ? (
        <NoMatches />
      ) : (
        <div className="grid gap-3">
          {filtered.map((event) => (
            <HostedEventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

function AllEventCard({ event }: { event: MemberEventCardRow }) {
  const typeMeta = TYPE_META[event.event_type] ?? TYPE_META.other;
  const LocationIcon = event.mode === "online" ? Monitor : MapPin;
  const location = event.mode === "online" ? "Online event" : event.venue_name ?? "Venue TBA";
  const seatsLeft =
    event.capacity == null ? null : Math.max(event.capacity - event.registered_count, 0);
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
                href={`/member/events/${event.id}`}
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

function HostedEventCard({ event }: { event: HostedEventRow }) {
  const badge = STATUS_BADGE[event.status] ?? STATUS_BADGE.draft!;
  const typeMeta = TYPE_META[event.event_type] ?? TYPE_META.other;
  const LocationIcon = event.mode === "online" ? Monitor : MapPin;
  const location = event.mode === "online" ? "Online event" : event.venue_name ?? "Venue TBA";

  return (
    <Card className="p-4">
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
            <span
              className={cn(
                "rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wide",
                typeMeta.className,
              )}
            >
              {typeMeta.label}
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
            <Link
              href={`/member/events/${event.id}/attendance`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <UserCheck className="size-4" aria-hidden="true" />
              Attendance
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}
