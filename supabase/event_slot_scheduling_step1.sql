-- STEP 1 of 2 — additive only. Safe on a live database.
--
-- Everything here ADDS: nullable columns, a new table, new functions, a trigger
-- on a column that did not exist before. Nothing the running app calls changes
-- shape, so registration keeps working throughout and this can be applied at
-- any time, with guests mid-booking.
--
-- The breaking half is in event_slot_scheduling_step2.sql: it replaces
-- register_prospect_for_event, which the live app calls on every booking.
--
-- Apply to STAGING (fxdsnacuonfvutdquogb) first, then PRODUCTION
-- (rvwseybgimmewuoccecu, real guests). Re-runnable.

-- ---------------------------------------------------------------------------
-- 1) Scheduling flags on the event
-- ---------------------------------------------------------------------------
alter table gema.events
  add column if not exists scheduling_enabled boolean not null default false,
  add column if not exists slot_minutes integer,
  -- Doctor+nurse teams working one window. One guest per team.
  add column if not exists teams_per_slot integer,
  -- The mid-day break, wall-clock in the event's own timezone. Both null means
  -- the day runs straight through.
  add column if not exists break_start time,
  add column if not exists break_end time,
  -- The working day, wall-clock in the event's timezone. A repeating clinic is
  -- ONE event whose starts_at..ends_at is the run, not one long sitting: without
  -- these the grid steps straight through the night and sells 11:30pm.
  add column if not exists day_start time,
  add column if not exists day_end time,
  -- ISO-ish day numbers, 0 = Sunday .. 6 = Saturday. Null means every day in
  -- the run; {5,6} is a Friday-Saturday clinic.
  add column if not exists weekdays smallint[];

alter table gema.events drop constraint if exists events_break_window;
alter table gema.events
  add constraint events_break_window
  check (
    (break_start is null and break_end is null)
    or (break_start is not null and break_end is not null and break_end > break_start)
  );

alter table gema.events drop constraint if exists events_day_window;
alter table gema.events
  add constraint events_day_window
  check (
    (day_start is null and day_end is null)
    or (day_start is not null and day_end is not null and day_end > day_start)
  );

alter table gema.events drop constraint if exists events_weekdays_range;
alter table gema.events
  add constraint events_weekdays_range
  check (
    weekdays is null
    or (
      array_length(weekdays, 1) between 1 and 7
      and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]
    )
  );

alter table gema.events drop constraint if exists events_teams_per_slot_check;
alter table gema.events
  add constraint events_teams_per_slot_check
  check (teams_per_slot is null or teams_per_slot between 1 and 20);

alter table gema.events drop constraint if exists events_slot_minutes_check;
alter table gema.events
  add constraint events_slot_minutes_check
  check (slot_minutes is null or (slot_minutes between 5 and 120 and slot_minutes % 5 = 0));

-- A grid needs a closing time. events.ends_at is nullable, and without it there
-- is nothing to step to, so scheduling and an open-ended event cannot coexist.
alter table gema.events drop constraint if exists events_scheduling_needs_window;
alter table gema.events
  add constraint events_scheduling_needs_window
  check (
    not scheduling_enabled
    or (ends_at is not null and slot_minutes is not null)
  );

-- ---------------------------------------------------------------------------
-- 2) The slots themselves
-- ---------------------------------------------------------------------------
create table if not exists gema.event_slots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references gema.events(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  seats_total integer not null check (seats_total > 0),
  seats_taken integer not null default 0 check (seats_taken >= 0),
  -- Lunch, a clinician's break, a window held back for staff.
  closed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint event_slots_time_order check (ends_at > starts_at),
  constraint event_slots_fit check (seats_taken <= seats_total),
  constraint event_slots_unique_start unique (event_id, starts_at)
);

create index if not exists event_slots_event_start_idx
  on gema.event_slots (event_id, starts_at);

-- The registration's slot. Nullable: every existing row, and every event that
-- never turns scheduling on, keeps working untouched.
alter table gema.event_registrations
  add column if not exists slot_id uuid references gema.event_slots(id) on delete set null;

create index if not exists event_registrations_slot_idx
  on gema.event_registrations (slot_id)
  where slot_id is not null;

-- ---------------------------------------------------------------------------
-- 3) RLS — slots are public to read, host/admin to write
-- ---------------------------------------------------------------------------
alter table gema.event_slots enable row level security;

drop policy if exists event_slots_public_read on gema.event_slots;
create policy event_slots_public_read on gema.event_slots
for select
using (
  exists (
    select 1 from gema.events e
    where e.id = event_slots.event_id
      and e.status = 'published'
  )
);

drop policy if exists event_slots_manage on gema.event_slots;
create policy event_slots_manage on gema.event_slots
for all
using (gema.can_manage_event(event_slots.event_id))
with check (gema.can_manage_event(event_slots.event_id));

-- ---------------------------------------------------------------------------
-- 4) Grid generation
--
-- Regenerates the grid for an event, then derives events.capacity from it.
--
-- Three things it is careful about:
--   * A slot that already holds a booking is never deleted. Its seats_total is
--     raised but never lowered below what is taken, and a booked slot left
--     outside the new window aborts the call rather than orphaning a pass.
--   * `closed` survives regeneration. Only slots that fall outside the new grid
--     are dropped, so a window the admin shut for a staff meeting does not
--     silently reopen the next time the host edits the event title.
--   * The break is applied to NEW slots only, for the same reason: an admin who
--     deliberately reopened a break window keeps it open.
--
-- The grid is one row per working day across the run, NOT one continuous span.
-- A repeating clinic is a single event so its landing URL never changes; the
-- run lives in starts_at..ends_at and the working day in day_start/day_end.
-- ---------------------------------------------------------------------------
create or replace function gema.generate_event_slots(
  p_event_id uuid,
  p_slot_minutes integer default 30,
  p_seats_per_slot integer default 1,
  -- Wall-clock in the event's own timezone, per event. Null/null runs the day
  -- straight through.
  p_break_start time default null,
  p_break_end time default null,
  -- The working day. Null/null falls back to the event's own start and end
  -- times on a single day, which is what a one-off clinic wants.
  p_day_start time default null,
  p_day_end time default null,
  -- Which days of the week run. Null means every date in the range.
  p_weekdays smallint[] default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'gema', 'public'
as $$
declare
  v_event gema.events;
  v_step interval;
  v_orphans integer;
  v_slots integer;
  v_seats integer;
begin
  if not gema.can_manage_event(p_event_id) then
    raise exception 'Not allowed to manage this event' using errcode = 'insufficient_privilege';
  end if;

  if p_slot_minutes is null or p_slot_minutes < 5 or p_slot_minutes > 120
     or p_slot_minutes % 5 <> 0 then
    raise exception 'Slot length must be 5-120 minutes, in steps of 5'
      using errcode = 'check_violation';
  end if;

  if p_seats_per_slot is null or p_seats_per_slot < 1 or p_seats_per_slot > 20 then
    raise exception 'A window needs between 1 and 20 teams' using errcode = 'check_violation';
  end if;

  if (p_break_start is null) <> (p_break_end is null) then
    raise exception 'A break needs both a start and an end' using errcode = 'check_violation';
  end if;

  if p_break_start is not null and p_break_end <= p_break_start then
    raise exception 'The break must end after it starts' using errcode = 'check_violation';
  end if;

  select * into v_event from gema.events where id = p_event_id;
  if not found then
    raise exception 'Event not found' using errcode = 'no_data_found';
  end if;

  if v_event.ends_at is null then
    raise exception 'Set an end time before turning scheduling on'
      using errcode = 'check_violation';
  end if;

  if (p_day_start is null) <> (p_day_end is null) then
    raise exception 'A working day needs both a start and an end'
      using errcode = 'check_violation';
  end if;

  if p_day_start is not null and p_day_end <= p_day_start then
    raise exception 'The working day must end after it starts'
      using errcode = 'check_violation';
  end if;

  if p_weekdays is not null and array_length(p_weekdays, 1) is null then
    raise exception 'Pick at least one day of the week' using errcode = 'check_violation';
  end if;

  v_step := make_interval(mins => p_slot_minutes);

  if v_event.starts_at + v_step > v_event.ends_at then
    raise exception 'The event is shorter than one slot'
      using errcode = 'check_violation';
  end if;

  -- The grid, built once and used three times: to spot bookings it would
  -- strand, to decide what to delete, and to insert.
  --
  -- One row per working day in the run, not one long span. A Friday-Saturday
  -- clinic is a single event whose starts_at..ends_at covers weeks; without the
  -- per-day window the old grid stepped through the night and put 11:30pm on
  -- sale. Dates are walked in the event's own timezone, so "Friday" means
  -- Friday in Manila.
  -- Belt and braces: two calls inside one transaction would collide on the name.
  drop table if exists tmp_grid;

  create temporary table tmp_grid on commit drop as
  with days as (
    select d::date as day
    from generate_series(
      (v_event.starts_at at time zone v_event.timezone)::date,
      (v_event.ends_at at time zone v_event.timezone)::date,
      interval '1 day'
    ) as d
    where p_weekdays is null
       or extract(dow from d)::smallint = any (p_weekdays)
  ),
  bounds as (
    select
      day,
      -- No working day set: fall back to the event's own times, which is what a
      -- one-off clinic has always meant.
      ((day + coalesce(p_day_start, (v_event.starts_at at time zone v_event.timezone)::time))
        at time zone v_event.timezone) as day_from,
      ((day + coalesce(p_day_end, (v_event.ends_at at time zone v_event.timezone)::time))
        at time zone v_event.timezone) as day_to
    from days
  )
  select
    g as starts_at,
    g + v_step as ends_at,
    -- Break windows are born closed. Wall-clock in the event's timezone, never
    -- UTC — 12:00 in Manila is 04:00 UTC.
    (
      p_break_start is not null
      and p_break_end is not null
      and (g at time zone v_event.timezone)::time >= p_break_start
      and (g at time zone v_event.timezone)::time < p_break_end
    ) as in_break
  from bounds
  cross join lateral generate_series(bounds.day_from, bounds.day_to - v_step, v_step) as g
  -- The run can start mid-morning and end mid-afternoon; never sell outside it.
  where g >= v_event.starts_at
    and g + v_step <= v_event.ends_at;

  create unique index on tmp_grid (starts_at);

  if not exists (select 1 from tmp_grid) then
    raise exception 'Those days and times produce no arrival windows'
      using errcode = 'check_violation';
  end if;

  -- A booked slot the new grid does not contain would strand a pass. Refuse,
  -- and let the host move the booking or widen the run first.
  select count(*) into v_orphans
  from gema.event_slots s
  where s.event_id = p_event_id
    and s.seats_taken > 0
    and not exists (select 1 from tmp_grid g where g.starts_at = s.starts_at);

  if v_orphans > 0 then
    raise exception
      'This change would strand % booked slot(s). Move those bookings first.', v_orphans
      using errcode = 'check_violation';
  end if;

  -- Drop only what the new grid no longer contains, and only if empty.
  delete from gema.event_slots s
  where s.event_id = p_event_id
    and s.seats_taken = 0
    and not exists (select 1 from tmp_grid g where g.starts_at = s.starts_at);

  insert into gema.event_slots (event_id, starts_at, ends_at, seats_total, closed)
  select p_event_id, g.starts_at, g.ends_at, p_seats_per_slot, g.in_break
  from tmp_grid g
  on conflict (event_id, starts_at) do update
    set ends_at = excluded.ends_at,
        -- Never below what is already booked; event_slots_fit would reject it.
        -- ON CONFLICT names the target unqualified.
        seats_total = greatest(excluded.seats_total, event_slots.seats_taken);
        -- `closed` is deliberately absent: the admin owns it after creation.

  -- Closed windows are not for sale, so they are not capacity.
  select
    count(*) filter (where not closed)::integer,
    coalesce(sum(seats_total) filter (where not closed), 0)::integer
    into v_slots, v_seats
  from gema.event_slots
  where event_id = p_event_id;

  -- No walk-ins: the grid is the capacity. Nothing else may set it.
  update gema.events
  set scheduling_enabled = true,
      slot_minutes = p_slot_minutes,
      teams_per_slot = p_seats_per_slot,
      break_start = p_break_start,
      break_end = p_break_end,
      day_start = p_day_start,
      day_end = p_day_end,
      weekdays = p_weekdays,
      capacity = v_seats
  where id = p_event_id;

  return jsonb_build_object(
    'slots', v_slots,
    'seats', v_seats,
    'slot_minutes', p_slot_minutes
  );
end;
$$;

grant execute on function gema.generate_event_slots(
  uuid, integer, integer, time, time, time, time, smallint[]
) to authenticated, service_role;

-- Turning scheduling off: keep the rows (a booked pass still points at one),
-- stop enforcing, and hand capacity back to the host.
create or replace function gema.disable_event_slots(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path to 'gema', 'public'
as $$
begin
  if not gema.can_manage_event(p_event_id) then
    raise exception 'Not allowed to manage this event' using errcode = 'insufficient_privilege';
  end if;

  delete from gema.event_slots
  where event_id = p_event_id and seats_taken = 0;

  update gema.events
  set scheduling_enabled = false
  where id = p_event_id;
end;
$$;

grant execute on function gema.disable_event_slots(uuid) to authenticated, service_role;

-- Close or reopen one window (lunch, a break) without touching the grid.
create or replace function gema.set_event_slot_closed(
  p_slot_id uuid,
  p_closed boolean
)
returns void
language plpgsql
security definer
set search_path to 'gema', 'public'
as $$
declare
  v_event_id uuid;
begin
  select event_id into v_event_id from gema.event_slots where id = p_slot_id;
  if not found then
    raise exception 'Slot not found' using errcode = 'no_data_found';
  end if;
  if not gema.can_manage_event(v_event_id) then
    raise exception 'Not allowed to manage this event' using errcode = 'insufficient_privilege';
  end if;

  update gema.event_slots set closed = p_closed where id = p_slot_id;
end;
$$;

grant execute on function gema.set_event_slot_closed(uuid, boolean)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5) Public availability
--
-- Anonymous read for the booking sheet. Past windows are dropped: a guest at
-- 10:40 must not be offered 09:00. Mirrors get_invite_event's visibility gate.
-- ---------------------------------------------------------------------------
create or replace function gema.get_event_slots(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'gema', 'public'
as $$
declare
  v_event gema.events;
begin
  select * into v_event from gema.events where id = p_event_id;
  if not found or v_event.status <> 'published' or not v_event.scheduling_enabled then
    return null;
  end if;

  return jsonb_build_object(
    'event_id', v_event.id,
    'timezone', v_event.timezone,
    'slot_minutes', v_event.slot_minutes,
    'slots', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'starts_at', s.starts_at,
            'ends_at', s.ends_at,
            'seats_total', s.seats_total,
            'seats_taken', s.seats_taken,
            'closed', s.closed
          )
          order by s.starts_at
        )
        from gema.event_slots s
        where s.event_id = p_event_id
          and s.ends_at > now()
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function gema.get_event_slots(uuid)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7) A cancelled booking gives its window back
--
-- v1 has no no-show release, but an explicit cancellation must not leave a dead
-- chair. Registration status is the trigger, so admin cancels, host cancels and
-- future guest-side cancels all free the slot through one path.
-- ---------------------------------------------------------------------------
create or replace function gema.event_registration_release_slot()
returns trigger
language plpgsql
security definer
set search_path to 'gema', 'public'
as $$
begin
  if tg_op = 'DELETE' then
    if old.slot_id is not null then
      update gema.event_slots
      set seats_taken = greatest(seats_taken - 1, 0)
      where id = old.slot_id;
    end if;
    return old;
  end if;

  if old.slot_id is not null
     and old.status <> 'cancelled'
     and new.status = 'cancelled' then
    update gema.event_slots
    set seats_taken = greatest(seats_taken - 1, 0)
    where id = old.slot_id;
  end if;

  -- Un-cancelling has to re-take the window, and it may be gone.
  if new.slot_id is not null
     and old.status = 'cancelled'
     and new.status <> 'cancelled' then
    update gema.event_slots
    set seats_taken = seats_taken + 1
    where id = new.slot_id
      and seats_taken < seats_total;
    if not found then
      raise exception 'That arrival time is full' using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists event_registrations_release_slot on gema.event_registrations;
create trigger event_registrations_release_slot
after update of status or delete on gema.event_registrations
for each row execute function gema.event_registration_release_slot();
