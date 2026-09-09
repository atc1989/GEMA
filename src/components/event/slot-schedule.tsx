"use client";

import { useEffect, useState, useTransition } from "react";
import { CircleSlash, Clock, Lock, LockOpen, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { setEventSlotClosed } from "@/lib/actions/event-slots";
import { formatWindowRange, groupSlotsByHour, type EventSlot } from "@/lib/events/slots";
import { cn } from "@/lib/utils";

export type ScheduleGuest = {
  registrationId: string;
  name: string;
  passCode: string;
  checkedIn: boolean;
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
  timezone,
  canEdit,
}: {
  eventId: string;
  slots: ScheduleSlot[];
  timezone: string;
  /** Cancelled or finished events are read-only. */
  canEdit: boolean;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [now, setNow] = useState<number | null>(null);

  // Post-mount only, then every half-minute — an arrival window does not need a
  // second hand.
  useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, []);

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

  const groups = groupSlotsByHour(slots, timezone);
  const open = slots.filter((s) => !s.closed);
  const booked = open.filter((s) => s.seatsTaken > 0);
  const seatsFree = open.reduce((sum, s) => sum + Math.max(s.seatsTotal - s.seatsTaken, 0), 0);

  return (
    <div className="grid gap-4">
      <Card className="grid grid-cols-3 gap-3 p-4 text-center">
        <Summary label="Booked" value={`${booked.length}`} />
        <Summary label="Seats free" value={`${seatsFree}`} />
        <Summary label="Closed" value={`${slots.length - open.length}`} />
      </Card>

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
                      <p className="text-sm font-semibold text-muted-foreground">Open</p>
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
