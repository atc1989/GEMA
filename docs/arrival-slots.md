# Arrival slots — medical and check-up landings

Ten-minute arrival windows on the two check-up templates. Guests pick a window
before they give their name; the window is the whole capacity.

Not on the One Account board. That board is the identity spine and its
**Current change** is *none*; this is event and booking work, so it is kept here
rather than invented onto a board the session gate says not to extend. If the
owner wants it tracked there, this file is the Change note ready to move.

## Decisions

| | |
|---|---|
| Slot length | 10 minutes, fixed |
| Working day | whatever the event's own start/end says. 9–5 gives 9–5 |
| Lunch | 12:00–13:00, created closed. So a 9–5 clinic is 9–12 and 1–5 |
| Capacity per slot | 1 doctor+nurse team = 1 guest |
| Clinician choice | none — guests pick a time, the team is assigned at the door |
| Walk-ins | none. The grid is the capacity |
| Copy | arrival window, never "appointment" |
| No-show release | **out of v1**. A booked window stays spent |
| Templates | medical and check-up only. Sizzle and Session book as before |

The grid comes from `events.starts_at` / `ends_at` — nothing hard-codes a
working day. A 9–5 event with the default break is 42 bookable windows: 18 in
the morning, 24 in the afternoon, 6 shut for lunch. With no walk-ins that is the
ceiling, and it is a hard one.

The break is applied to **new** windows only, and `closed` survives
regeneration. Reopen 12:20 for a day that works through lunch and editing the
event title later will not shut it again.

## Why a window and not an appointment

A 10-minute grid at a free community check-up holds for about forty minutes and
then runs late. "Your slot: 9:20" turns that into a complaint; "arrive
9:00–9:10, you are seen in the order people arrive" absorbs it. The allocation
underneath is identical.

So a slot row **is** the arrival window. No offset, no phantom slot before the
event start.

## Shape

```
gema.events
  scheduling_enabled  bool, default false
  slot_minutes        int, null unless scheduled
  capacity            DERIVED when scheduled — sum(event_slots.seats_total)

gema.event_slots
  event_id, starts_at, ends_at
  seats_total   teams working that window (1 in v1)
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
| `supabase/event_slot_scheduling.sql` | the whole migration |
| `src/lib/events/slots.ts` | types, parsing, window formatting |
| `src/lib/actions/event-slots.ts` | `loadEventScheduling` — SSR and client refresh |
| `src/lib/actions/registration.ts` | passes `slotId`, returns the booked window |
| `src/components/landing/book-sheet.tsx` | the picker step |
| `src/components/landing/{ginhawa,checkup}-landing.tsx` | sold-out states |
| `src/components/prospect/prospect-registration-form.tsx` | `/register` fallback |
| `src/components/event/event-form.tsx` | the host toggle |
| `src/components/attendance/attendance-table.tsx` | the window at the door |
| `src/app/(admin)/admin/events/[id]/schedule/page.tsx` | the clinic day, window by window |
| `src/components/event/slot-schedule.tsx` | the grid, with the open/close toggle |

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

**Order matters.** The migration drops the 11-argument
`register_prospect_for_event` and creates a 12-argument one. Old app code sends
11 and gets `PGRST202` against the new signature.

1. Apply `supabase/event_slot_scheduling.sql` to Staging
   (`fxdsnacuonfvutdquogb`).
2. Ship the app.
3. Same file promotes to Production (`rvwseybgimmewuoccecu`) — it is re-runnable.

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
- **The break is a constant**, not a per-event setting. `BREAK_START` /
  `BREAK_END` in `src/lib/events/slots.ts`, passed to the RPC, which takes them
  as parameters. An event that breaks at 11:30 needs the admin to reopen 12:00
  and close 11:30 by hand.
- **No host-side schedule page.** Admins have one; a non-admin host managing
  their own event does not.
