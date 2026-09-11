# Arrival slots — medical and check-up landings

Arrival windows on the two check-up templates. Guests pick a window before they
give their name; the window is the whole capacity.

Not on the One Account board. That board is the identity spine and its
**Current change** is *none*; this is event and booking work, so it is kept here
rather than invented onto a board the session gate says not to extend. If the
owner wants it tracked there, this file is the Change note ready to move.

## Decisions

| | |
|---|---|
| Slot length | per event, 30 minutes by default. 10/15/20/30/45/60 on the form |
| Occurrences | one event per date, new link each time. **Duplicate** does the setup |
| Working day | per event, `day_start`/`day_end`. Blank falls back to the event times |
| Days that run | per event weekday set. Blank means every date in the run |
| Break | per event, 12:00–13:00 by default, blank for none |
| Teams per window | per event, 1 by default, 1-6 on the form. One guest each |
| Clinician choice | none — guests pick a time, the team is assigned at the door |
| Walk-ins | none. A full day takes a **standby list** instead, capped at 80/day |
| Seats shown | exact above 5, "only a few seats left" at 1-5, never a number at 0 |
| Copy | arrival window, never "appointment" |
| No-show release | **in**. A button, not a timer — it is what moves the queue |
| Templates | medical and check-up only. Sizzle and Session book as before |

The grid comes from `events.starts_at` / `ends_at` — nothing hard-codes a
working day. **A 9–5 event with the default hour's break is 14 seats**: 6 in the
morning, 8 in the afternoon, 2 windows shut for lunch. With no walk-ins that is
the whole day at one team. Two teams is 28, three is 42 — teams per window is
the only lever that raises the seat count without shortening the window, and it
is on the event form.

Window length and the break both live on the event (`slot_minutes`,
`break_start` / `break_end`, the last two wall-clock in the event's own
timezone) and are set on the event form. The form offers 10, 15, 20, 30, 45 and
60 minutes — every one divides an hour and satisfies the database's "5-120, in
steps of 5" check, so the picker cannot build a grid the RPC would reject. Both
break fields blank runs the day straight through.

**Shortening the window on an event that already has bookings is refused**, not
silently re-gridded: 30 → 20 moves the grid to :00/:20/:40 and a booked 9:30
would be stranded, so the generator counts them and raises. That message is
written for the host and passes through to the form intact rather than being
flattened by `friendlyDbError`.

It is applied to **new** windows only, and `closed` survives regeneration:
reopen a break window by hand and editing the event title later will not shut it
again. Moving the break in the form therefore opens the new windows but leaves
the old ones closed until someone reopens them on the schedule page — the
alternative was overruling a deliberate close, which is worse.

## A repeating clinic is a new event each time

**Decided 2026-09-10:** each occurrence is its own event with its own link.
Registrations, capacity and attendance separate by construction — no filters, no
shared list to pull apart later.

That only works because setting the next one up is a button. **Duplicate** on
the event page copies the event row, its speakers, its landing (copy,
clinicians, media, venue, gift points) and its arrival-slot settings into a
fresh draft a week on, then opens its edit form. Deliberately not copied:
status, publication, the pin, cancellation marks, and every registration, slot
and attendance record — the copy starts empty.

The landing's date and time labels are regenerated rather than copied. A
duplicate still advertising last Friday is worse than one with no date.

### Multi-day events still work

The working-day fields below stay, and stay optional. Blank `day_start`/
`day_end` falls back to the event's own times, so a one-day event behaves as it
always did; day tabs and the attendance day filter only appear when a run spans
more than one day.

They are not decoration. **An event spanning Friday 9am to Saturday 5pm without
them sells Friday 11:30pm** — the grid steps continuously from `starts_at` to
`ends_at`. So a weekend kept as one event still needs them:

```
starts_at .. ends_at     the run — extend the end date to add more weeks
weekdays                 {5,6} for Friday and Saturday
day_start .. day_end     09:00-17:00, worked on each of those days
break_start .. break_end 12:00-13:00, closed on each of those days
```

The grid is therefore **one block per working day**, not one continuous span.
That distinction is not cosmetic: without it the generator stepped straight
from Friday 9am to Saturday 5pm and put Friday 11:30pm on sale.

### Which day is a guest coming?

`event_registrations.slot_id -> event_slots.starts_at`. That is the day they are
**coming**, which is the only axis that separates a repeating clinic's
registrations.

It is emphatically *not* `registered_at`. A plain date filter on the attendance
list would have used that and put a Monday sign-up for Saturday's clinic into
Monday's bucket.

Everything follows from it: the booking sheet shows day tabs and defaults to the
first day with room, the admin schedule shows one day at a time with per-day
counters, and both attendance pages take `?day=YYYY-MM-DD`.

## Standby

A full day used to be a closed door. It now takes names, up to 80 per day.

```
event_registrations.standby      true = in the queue, holds no window
event_registrations.standby_day  which day of a run they mean to come
events.standby_enabled           per event
events.standby_limit             per event per day, 80 by default
```

**Queue position is derived, never stored** — `standby_position()` counts by
`registered_at`. Cancel number three and number four becomes three, which is the
only behaviour a queue can have without going stale.

`standby` is explicit rather than inferred from a null `slot_id`: on an
unscheduled event every row has a null slot, and those guests are booked.

Two guests racing the last place is a check-then-act with no single row to lock,
so the standby path takes `pg_advisory_xact_lock` on the event. The slot claim
still does not need one — there it is a real row.

### What the page says about seats

| Seats left | Shown |
|---|---|
| Above 5 | `Free · 12 seats left` |
| 1 to 5 | `Free · only a few seats left` |
| 0, standby open | `Fully booked · standby open`, CTA becomes **Join the standby list** |
| 0, standby full | `Fully booked`, CTA goes |

Vague where the number is scarce and pressure is useful; never claiming seats
that are gone. Somebody who travels an hour on the strength of "a few seats
left" and is turned away costs more than the registration did.

### A no-show is what moves the queue

Marking a booked guest a no-show frees their window, and the schedule page shows
the queue beside the seats freed so the door can call the next name.

It is a button, not a timer: a clock at :05 past cannot see that the guest is
queuing outside or eight minutes away in traffic, and would cancel real
people's passes. It is also reversible — and the release trigger refuses the
undo if somebody from the queue has since taken the window.

`event_standby.sql` also widens that trigger, which fired only on `cancelled`.
A no-show left the window locked, which would have made standby a queue that
never moves.

### Standby never gets a time

A standby guest picks a **day** on a multi-day run, and nothing finer. The door
list marks them `Standby · no fixed time` so staff scanning in order do not seat
walk-ups ahead of the people who booked 10:30 and did what was asked.

E-Points are held the same way as a booked seat: paid on check-in, and a standby
guest who is not seen gets nothing.

## Why a window and not an appointment

A fixed grid at a free community check-up runs late by mid-morning. "Your slot:
9:30" turns that into a complaint; "arrive 9:00–9:30, you are seen in the order
people arrive" absorbs it. The allocation underneath is identical.

So a slot row **is** the arrival window. No offset, no phantom slot before the
event start.

## Shape

```
gema.events
  scheduling_enabled  bool, default false
  slot_minutes        int, null unless scheduled
  teams_per_slot      int, 1-20, null unless scheduled
  break_start         time, null for a day with no break
  break_end           time, both-or-neither, end after start
  day_start           time, the working day within a multi-day run
  day_end             time, both-or-neither, end after start
  weekdays            smallint[], 0=Sun..6=Sat, null means every day
  capacity            DERIVED when scheduled — sum(seats_total) of OPEN slots

gema.event_slots
  event_id, starts_at, ends_at
  seats_total   teams working that window, one guest each
  seats_taken
  closed        lunch, a break
  unique (event_id, starts_at)

gema.event_registrations
  slot_id       nullable FK — every pre-existing row stays valid
```

`events.ends_at` is nullable, and a grid needs a closing time, so a CHECK
constraint makes scheduling and an open-ended event mutually exclusive. The form
says the same thing in words.

### The claim is one conditional UPDATE

```sql
update gema.event_slots
   set seats_taken = seats_taken + 1
 where id = p_slot_id and not closed
   and ends_at > now() and seats_taken < seats_total
returning id;
```

Postgres row-locks the matched slot, so two guests racing the same window
serialise: the loser matches zero rows and is told so. No advisory lock, no
retry loop, no `count(*)` race.

The old flat `count(*) >= capacity` check still runs, but only on unscheduled
events — on a scheduled one the grid is the cap and the counter would
double-count.

## Files

| | |
|---|---|
| `supabase/event_slot_scheduling.sql` | the slots migration (the two steps, concatenated) |
| `supabase/event_standby.sql` | standby, and the no-show release fix |
| `src/lib/events/slots.ts` | types, parsing, window formatting |
| `src/lib/actions/event-slots.ts` | `loadEventScheduling` — SSR and client refresh |
| `src/lib/actions/registration.ts` | passes `slotId`, returns the booked window |
| `src/components/landing/book-sheet.tsx` | the picker step |
| `src/components/landing/{ginhawa,checkup}-landing.tsx` | sold-out states |
| `src/components/prospect/prospect-registration-form.tsx` | `/register` fallback |
| `src/components/event/event-form.tsx` | the host toggle |
| `src/components/attendance/attendance-table.tsx` | the window at the door |
| `src/components/attendance/attendance-day-tabs.tsx` | one day of a run at a time |
| `duplicateEvent` in `src/lib/actions/events.ts` | the copy button behind a repeat |
| `src/app/(admin)/admin/events/[id]/schedule/page.tsx` | the clinic day, window by window |
| `src/components/event/slot-schedule.tsx` | the grid, with the open/close toggle |
| `src/components/landing/pass-recall.tsx` | the way back to a booked pass |
| `src/lib/events/booked-pass.ts` | the local breadcrumb, no QR token in it |

### The admin schedule

`/admin/events/[id]/schedule`, linked from the event page when scheduling is on.
One row per window: the time, who is booked into it (name, pass code, and
whether they have checked in), and a toggle to close or reopen it. A window
holding a booking cannot be closed — the guest already has a pass for it — so
the button is disabled and the action refuses it server-side too.

It reads `event_slots` directly rather than through `get_event_slots`. That RPC
is the public one: it hides past windows and carries no names, which is right
for the picker and useless for running a door.

"Now" is marked live and ticks every thirty seconds, computed after mount only —
a server-rendered clock and a client-rendered one a second later are a hydration
mismatch.

### Getting back to a pass

`/passes` could always find a pass from a name plus the email or mobile used to
book, but nothing on the landing said so — the QR lived inside the booking
sheet, and dismissing it was the end of it.

`PassRecall` sits on both check-up templates. On a device that booked, it names
the pass code and downloads the QR in one tap; otherwise it is a plain "find my
pass" link, which still works from any device.

What it stores is the pass code, name and contact — **never the QR token**. That
token is what gets someone through the door, and a shared phone or a
computer-shop machine would otherwise hand the next person the previous guest's
pass. So the download calls `issuePassQrToken`, which re-issues it server-side
behind the same gate `/passes` uses: name AND the email or mobile, because an
email alone is shared across group sign-ups and reused numbers. **Not you?**
clears the breadcrumb outright.

The booking sheet also saves the PNG the moment the pass exists, and keeps a
**Download my QR** button next to it. Both are best-effort: in-app browsers —
Messenger, where most of this traffic comes from — swallow a download silently,
which is exactly why the recall strip is the dependable path and the auto-save
is the convenience.

### Staleness

The grid renders on the server and is stale by the time the sheet opens, so the
sheet re-reads it on open and again whenever a claim loses the race — and sends
the guest back to the picker with every field they typed still filled. Losing a
typed form to a race is how you lose the booking.

`isSoldOut` and `slotHasSeats` are deliberately clock-independent: the landing
renders on the server first, and "is 9:00 past?" answered twice a second apart
is a hydration mismatch. The time-aware `slotIsOpen` is only used inside the
sheet, which never renders before mount.

## Deploy

**GEMA runs on Production Auth (`rvwseybgimmewuoccecu`, ~431 real accounts).**
The migration replaces `register_prospect_for_event`, which the deployed app
calls on every booking, so it ships in two halves:

| | |
|---|---|
| `event_slot_scheduling_step1.sql` | additive only — columns, the slots table, the RPCs, the trigger. Safe with guests mid-booking |
| `event_slot_scheduling_step2.sql` | replaces `register_prospect_for_event`. Run after the app is deployed |

`event_slot_scheduling.sql` is the two concatenated. It is fine on a database
nobody is using and wrong on a live one.

Order, per database — Staging first, then Production:

1. **Step 1.** Nothing the running app calls changes shape.
2. **Deploy the app.** It sends `p_slot_id` only when a window was picked, so an
   unscheduled booking still resolves against the old 11-argument function.
3. **Step 2.** Both signatures cannot coexist — PostgREST cannot choose between
   an 11-argument function and a 12-argument one whose last argument defaults,
   so it refuses both. The drop and create share a transaction; other sessions
   block rather than error.

Because of step 2's app-side tolerance, the gap between 2 and 3 is harmless:
arrival times simply do not work yet, and no event has them switched on.

After any of it, PostgREST caches the schema — `notify pgrst, 'reload schema';`
if the app still cannot see a new column.

Run it **after** `remove_registration_city.sql`, which holds the current
signature. Do not apply an older copy of that function afterwards
(`fix_member_event_cards.sql`, `lead_backfill_host_fallback.sql`,
`lead_referrals.sql`) — it would drop the slot claim and the referral logic
would go back a generation.

## Left open

- **No-show release.** Out of v1 by decision. With no walk-ins a no-show is a
  chair nobody can fill; at 24 seats a normal 20% no-show rate is five empty
  chairs and five people turned away. The database is ready for it — cancelling
  a registration already frees its window through a trigger — so this is an
  admin screen, not a migration.
- **Pending rows are still ordered by registration time**, not by window. Door
  staff who want "who is due next" would want that sort; it changes the list for
  unscheduled events too, so it was left alone.
- **`rsvpMemberToEvent`** takes no slot. Members RSVP without a window, which is
  right for staff and hosts, and wrong if a member should queue like everyone
  else.
- **Turning scheduling off leaves the derived capacity behind.** `capacity`
  keeps the number the grid produced and becomes the host's to edit again. It is
  not wrong, just no longer derived — nobody is locked out by it.
- **Multiple teams.** `seats_total` is per-slot in the database and the host
  form hard-codes 1. Two teams is a form change, not a migration.
- **Changing the break does not reopen the old break windows.** `closed`
  survives regeneration on purpose, so a moved break needs the old windows
  reopened by hand on the schedule page.
- **No host-side schedule page.** Admins have one; a non-admin host managing
  their own event does not.
