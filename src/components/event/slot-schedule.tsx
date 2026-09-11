"use client";

import { useEffect, useState, useTransition } from "react";
import { CircleSlash, Clock, Lock, LockOpen, UserRound, UserX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { markRegistrationNoShow } from "@/lib/actions/attendance";
import { setEventSlotClosed } from "@/lib/actions/event-slots";
import {
  formatWindowRange,
  groupSlotsByDay,
  groupSlotsByHour,
  type EventSlot,
} from "@/lib/events/slots";
import { cn } from "@/lib/utils";

export type ScheduleGuest = {
  registrationId: string;
  name: string;
  passCode: string;
  checkedIn: boolean;
  noShow: boolean;
};

/** Somebody waiting for a seat to open up, in the order they joined. */
export type StandbyGuest = {
  registrationId: string;
  name: string;
  passCode: string;
  checkedIn: boolean;
  /** "YYYY-MM-DD" in the event timezone, or null on a single-day event. */
  day: string | null;
};

export type ScheduleSlot = EventSlot & {
  /** Who booked this window. Admin-only — never sent to the public picker. */
  guests: ScheduleGuest[];
};

/**
 * The clinic day, one row per arrival window.
 *
 * Two jobs, and they want different things: setting up before the event (close
 * the windows nobody is working) and running the door on the day (who is due
 * now, who has arrived). The "due now" marker is the only concession to the
 * second — it is computed after mount, because a server-rendered "now" and a
 * client-rendered one a second later are a hydration mismatch.
 */
export function SlotSchedule({
  eventId,
  slots,
  standby,
  timezone,
  canEdit,
}: {
  eventId: string;
  slots: ScheduleSlot[];
  /** The queue. Empty when the event takes no standby. */
  standby: StandbyGuest[];
  timezone: string;
  /** Cancelled or finished events are read-only. */
  canEdit: boolean;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [now, setNow] = useState<number | null>(null);
  // A repeating clinic is one event, so the grid can be weeks long. One day at
  // a time is the only way this reads.
  const [day, setDay] = useState<string | null>(null);

  // Post-mount only, then every half-minute — an arrival window does not need a
  // second hand.
  useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, []);

  const setNoShow = (guest: ScheduleGuest) => {
    if (!canEdit) return;
    setPendingId(guest.registrationId);
    setError(null);
    startTransition(async () => {
      const result = await markRegistrationNoShow({
        eventId,
        registrationId: guest.registrationId,
        noShow: !guest.noShow,
      });
      setPendingId(null);
      if (!result.ok) setError(result.error);
    });
  };

  const toggle = (slot: ScheduleSlot) => {
    if (!canEdit || slot.seatsTaken > 0) return;
    setPendingId(slot.id);
    setError(null);
    startTransition(async () => {
      const result = await setEventSlotClosed(eventId, slot.id, !slot.closed);
      setPendingId(null);
      if (!result.ok) setError(result.error);
    });
  };

  const days = groupSlotsByDay(slots, timezone);
  const activeDay = days.find((d) => d.key === day) ?? days[0] ?? null;
  const shown = days.length > 1 ? (activeDay?.slots ?? []) : slots;
  const groups = groupSlotsByHour(shown, timezone);
  // Counters follow the day on screen: "14 seats free" across three weeks is
  // not a number anyone can act on.
  const open = shown.filter((s) => !s.closed);
  // Seats, not windows: with two teams a window holds two guests, and "3 booked"
  // meaning three windows would understate the room.
  const seatsBooked = open.reduce((sum, s) => sum + s.seatsTaken, 0);
  const seatsFree = open.reduce((sum, s) => sum + Math.max(s.seatsTotal - s.seatsTaken, 0), 0);
  const closedCount = shown.length - open.length;
  // The queue for the day on screen. A freed seat is one a booked guest did not
  // turn up for, which is exactly what the next name in line is waiting on.
  const dayStandby =
    days.length > 1 && activeDay
      ? standby.filter((g) => g.day === activeDay.key)
      : standby;

  return (
    <div className="grid gap-4">
      <Card className="grid grid-cols-3 gap-3 p-4 text-center">
        <Summary label="Booked" value={`${seatsBooked}`} />
        <Summary label="Seats free" value={`${seatsFree}`} />
        <Summary label="Closed" value={`${closedCount}`} />
      </Card>

      {dayStandby.length > 0 || seatsFree > 0 ? (
        <Card className="grid gap-3 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-black">
              Standby · {dayStandby.length} waiting
            </p>
            <p className="text-sm font-bold text-success">
              {seatsFree} seat{seatsFree === 1 ? "" : "s"} free
            </p>
          </div>
          {dayStandby.length === 0 ? (
            <p className="text-sm font-semibold text-muted-foreground">
              Nobody waiting.
            </p>
          ) : (
            <ol className="grid gap-1">
              {dayStandby.map((guest, index) => (
                <li
                  key={guest.registrationId}
                  className="flex flex-wrap items-center gap-x-2 text-sm font-bold"
                >
                  <span className="w-6 shrink-0 tabular-nums text-muted-foreground">
                    {index + 1}.
                  </span>
                  <span className="truncate">{guest.name}</span>
                  <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                    {guest.passCode}
                  </span>
                  {guest.checkedIn ? (
                    <span className="text-[10px] font-black uppercase tracking-wide text-success">
                      Seen
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
          <p className="text-xs font-semibold text-muted-foreground">
            Mark a booked guest a no-show to free their window, then call the next name.
          </p>
        </Card>
      ) : null}

      {days.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Days">
          {days.map((d) => {
            const dayBooked = d.slots.reduce((sum, x) => sum + x.seatsTaken, 0);
            return (
              <button
                key={d.key}
                type="button"
                aria-pressed={d.key === activeDay?.key}
                onClick={() => setDay(d.key)}
                className={cn(
                  "shrink-0 rounded-xl border-2 px-3 py-2 text-left",
                  d.key === activeDay?.key
                    ? "border-foreground bg-secondary/60"
                    : "border-border bg-background",
                )}
              >
                <span className="block text-sm font-black">{d.label}</span>
                <span className="block text-[11px] font-semibold text-muted-foreground">
                  {dayBooked} booked
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {error ? (
        <p className="text-sm font-semibold text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {slots.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm font-semibold text-muted-foreground">
            No arrival windows yet. Turn on &ldquo;Book by arrival time&rdquo; when you edit the
            event.
          </p>
        </Card>
      ) : null}

      {groups.map((group) => (
        <div key={group.key} className="grid gap-2">
          <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
            {group.label}
          </p>
          <Card className="divide-y divide-border p-0">
            {group.slots.map((s) => {
              const start = new Date(s.startsAt).getTime();
              const end = new Date(s.endsAt).getTime();
              const isNow = now !== null && now >= start && now < end;
              const isPast = now !== null && now >= end;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "grid gap-2 p-3 min-[560px]:flex min-[560px]:items-center min-[560px]:gap-4",
                    isNow && "bg-brand/5",
                    isPast && !isNow && "opacity-60",
                  )}
                >
                  <div className="flex min-w-[140px] items-center gap-2">
                    <span className="text-sm font-black tabular-nums">
                      {formatWindowRange(s.startsAt, s.endsAt, timezone)}
                    </span>
                    {isNow ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                        <Clock className="size-3" aria-hidden="true" />
                        Now
                      </span>
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    {s.closed ? (
                      <p className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
                        <CircleSlash className="size-4" aria-hidden="true" />
                        Closed
                      </p>
                    ) : s.guests.length === 0 ? (
                      <p className="text-sm font-semibold text-muted-foreground">
                        Open{s.seatsTotal > 1 ? ` · ${s.seatsTotal} seats` : ""}
                      </p>
                    ) : (
                      <ul className="grid gap-1">
                        {s.guests.map((guest) => (
                          <li
                            key={guest.registrationId}
                            className="flex flex-wrap items-center gap-x-2 text-sm font-bold"
                          >
                            <UserRound
                              className={cn(
                                "size-4 shrink-0",
                                guest.checkedIn ? "text-success" : "text-muted-foreground",
                              )}
                              aria-hidden="true"
                            />
                            <span className="truncate">{guest.name}</span>
                            <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                              {guest.passCode}
                            </span>
                            {guest.checkedIn ? (
                              <span className="text-[10px] font-black uppercase tracking-wide text-success">
                                In
                              </span>
                            ) : null}
                            {guest.noShow ? (
                              <span className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                                No-show
                              </span>
                            ) : null}
                            {canEdit && !guest.checkedIn ? (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground underline underline-offset-2 hover:text-foreground"
                                disabled={pendingId === guest.registrationId}
                                onClick={() => setNoShow(guest)}
                              >
                                <UserX className="size-3" aria-hidden="true" />
                                {guest.noShow ? "Undo" : "No-show"}
                              </button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {canEdit ? (
                    <div className="min-[560px]:shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        // A booked window cannot be closed: the guest already
                        // holds a pass for it. Cancel the booking first.
                        disabled={s.seatsTaken > 0 || pendingId === s.id}
                        onClick={() => toggle(s)}
                      >
                        {s.closed ? (
                          <>
                            <LockOpen aria-hidden="true" /> Open
                          </>
                        ) : (
                          <>
                            <Lock aria-hidden="true" /> Close
                          </>
                        )}
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </Card>
        </div>
      ))}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xl font-black tabular-nums">{value}</p>
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
