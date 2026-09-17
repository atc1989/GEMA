import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ScanLine } from "lucide-react";

import {
  EventWhenWhere,
  type EventWhenWhere as EventWhenWhereRow,
} from "@/components/event/event-when-where";
import {
  SlotSchedule,
  type ScheduleGuest,
  type ScheduleSlot,
  type StandbyGuest,
} from "@/components/event/slot-schedule";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatClockLabel, formatWeekdays, SLOT_MINUTES } from "@/lib/events/slots";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type SlotRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  seats_total: number;
  seats_taken: number;
  closed: boolean;
};

type BookingRow = {
  id: string;
  slot_id: string | null;
  attendee_name: string;
  pass_code: string;
  status: string;
  standby: boolean | null;
  standby_day: string | null;
};

export const dynamic = "force-dynamic";

/**
 * The clinic day, window by window.
 *
 * Reads event_slots directly rather than through get_event_slots: that RPC is
 * the public one, it hides past windows and carries no names. Setting the day
 * up needs the whole grid, and running the door needs the names.
 */
export default async function EventSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, title, status, mode, starts_at, timezone, venue_name, venue_address, map_url, online_url, scheduling_enabled, slot_minutes, break_start, break_end, day_start, day_end, weekdays",
    )
    .eq("id", id)
    .maybeSingle<
      EventWhenWhereRow & {
        title: string;
        status: string;
        scheduling_enabled: boolean | null;
        slot_minutes: number | null;
        break_start: string | null;
        break_end: string | null;
        day_start: string | null;
        day_end: string | null;
        weekdays: number[] | null;
      }
    >();
  if (!event) notFound();

  const [{ data: slotRows }, { data: bookings }, { data: atts }] = await Promise.all([
    supabase
      .from("event_slots")
      .select("id, starts_at, ends_at, seats_total, seats_taken, closed")
      .eq("event_id", id)
      .order("starts_at", { ascending: true })
      .returns<SlotRow[]>(),
    supabase
      .from("event_registrations")
      // Standby rows come back too — they hold no slot, so without them the
      // day's real headcount is missing everybody in the queue.
      .select("id, slot_id, attendee_name, pass_code, status, standby, standby_day")
      .eq("event_id", id)
      .neq("status", "cancelled")
      .order("registered_at", { ascending: true })
      .returns<BookingRow[]>(),
    supabase
      .from("attendance_records")
      .select("registration_id")
      .eq("event_id", id)
      .returns<{ registration_id: string }[]>(),
  ]);

  const checkedIn = new Set((atts ?? []).map((a) => a.registration_id));

  const guestsBySlot = new Map<string, ScheduleGuest[]>();
  const standby: StandbyGuest[] = [];
  for (const booking of bookings ?? []) {
    if (booking.standby) {
      standby.push({
        registrationId: booking.id,
        name: booking.attendee_name,
        passCode: booking.pass_code,
        checkedIn: checkedIn.has(booking.id),
        day: booking.standby_day,
      });
      continue;
    }
    if (!booking.slot_id) continue;
    const list = guestsBySlot.get(booking.slot_id) ?? [];
    list.push({
      registrationId: booking.id,
      name: booking.attendee_name,
      passCode: booking.pass_code,
      checkedIn: checkedIn.has(booking.id),
      noShow: booking.status === "no_show",
    });
    guestsBySlot.set(booking.slot_id, list);
  }

  const slots: ScheduleSlot[] = (slotRows ?? []).map((row) => ({
    id: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    seatsTotal: row.seats_total,
    seatsTaken: row.seats_taken,
    closed: row.closed,
    guests: guestsBySlot.get(row.id) ?? [],
  }));

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid gap-3 min-[520px]:flex min-[520px]:items-center min-[520px]:justify-between">
        <Link
          href={`/admin/events/${id}`}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to event
        </Link>
        <Link
          href={`/admin/events/${id}/scan`}
          className={cn(
            buttonVariants({ variant: "brand", size: "sm" }),
            "w-full min-[420px]:w-auto",
          )}
        >
          <ScanLine aria-hidden="true" />
          Open scanner
        </Link>
      </div>

      <div>
        <h2 className="text-lg font-black tracking-tight">{event.title}</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Arrival schedule · {event.slot_minutes ?? SLOT_MINUTES}-minute windows
          {event.break_start && event.break_end
            ? ` · break ${formatClockLabel(event.break_start)}–${formatClockLabel(event.break_end)}`
            : " · no break"}
        </p>
        {event.day_start && event.day_end ? (
          <p className="text-sm font-semibold text-muted-foreground">
            {formatWeekdays(event.weekdays)} · {formatClockLabel(event.day_start)}–
            {formatClockLabel(event.day_end)} each day
          </p>
        ) : null}
        <EventWhenWhere event={event} />
      </div>

      {event.scheduling_enabled ? null : (
        <Card className="border-brand/20 bg-secondary/40 p-4">
          <p className="text-sm font-semibold">
            Arrival times are off for this event. Any windows below are left over from when
            it was on, and guests are booking without one.
          </p>
        </Card>
      )}

      <SlotSchedule
        eventId={id}
        slots={slots}
        standby={standby}
        timezone={event.timezone}
        canEdit={event.status !== "cancelled" && event.status !== "completed"}
      />
    </div>
  );
}
