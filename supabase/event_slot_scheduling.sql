-- Ten-minute arrival slots for medical / check-up landings.
--
-- Apply to STAGING (fxdsnacuonfvutdquogb, schema gema) first.
-- Re-runnable later on Lifestyle (rvwseybgimmewuoccecu): the same file is the
-- promote step. Safe to re-run — every DDL is IF EXISTS / IF NOT EXISTS.
--
-- Run after remove_registration_city.sql. That file holds the current 11-arg
-- register_prospect_for_event; this one drops it and recreates it with 12,
-- carrying the referral -> sponsor resolution and the host fallback forward
-- unchanged. Do NOT apply an older copy of that function afterwards
-- (fix_member_event_cards.sql, lead_backfill_host_fallback.sql, lead_referrals.sql).
--
-- Deploy order: run this SQL BEFORE shipping the app change. The old app code
-- sends 11 args and gets PGRST202 against the new signature, so keep the
-- window short.
--
-- Model:
--   * A slot IS the arrival window. "Arrive 9:00-9:10", not "appointment 9:00".
--   * seats_total is the number of doctor+nurse teams working that window.
--     v1 ships one team, so seats_total = 1 and a slot holds one guest.
--   * No walk-ins: when scheduling is on, events.capacity is DERIVED from the
--     grid, never typed by the host.
--   * No no-show release in v1. A booked slot stays spent.

-- ---------------------------------------------------------------------------
-- 1) Scheduling flags on the event
-- ---------------------------------------------------------------------------
alter table gema.events
  add column if not exists scheduling_enabled boolean not null default false,
  add column if not exists slot_minutes integer;

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
--   * The lunch break is applied to NEW slots only, for the same reason: an
--     admin who deliberately reopened 12:20 keeps it open.
-- ---------------------------------------------------------------------------
create or replace function gema.generate_event_slots(
  p_event_id uuid,
  p_slot_minutes integer default 10,
  p_seats_per_slot integer default 1,
  -- Wall-clock in the event's own timezone. Nobody works 9 to 5 straight.
  p_break_start time default '12:00',
  p_break_end time default '13:00'
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

  if p_seats_per_slot is null or p_seats_per_slot < 1 then
    raise exception 'A slot needs at least one team' using errcode = 'check_violation';
  end if;

  select * into v_event from gema.events where id = p_event_id;
  if not found then
    raise exception 'Event not found' using errcode = 'no_data_found';
  end if;

  if v_event.ends_at is null then
    raise exception 'Set an end time before turning scheduling on'
      using errcode = 'check_violation';
  end if;

  v_step := make_interval(mins => p_slot_minutes);

  if v_event.starts_at + v_step > v_event.ends_at then
    raise exception 'The event is shorter than one slot'
      using errcode = 'check_violation';
  end if;

  -- A booked slot outside the new grid would strand a pass. Refuse, and let the
  -- host move the booking or widen the window first.
  select count(*) into v_orphans
  from gema.event_slots s
  where s.event_id = p_event_id
    and s.seats_taken > 0
    and (
      s.starts_at < v_event.starts_at
      or s.starts_at + v_step > v_event.ends_at
      -- Off-grid: interval has no modulo operator, so compare in seconds.
      or mod(
           extract(epoch from (s.starts_at - v_event.starts_at))::bigint,
           (p_slot_minutes * 60)::bigint
         ) <> 0
    );

  if v_orphans > 0 then
    raise exception
      'This change would strand % booked slot(s). Move those bookings first.', v_orphans
      using errcode = 'check_violation';
  end if;

  -- Drop only what the new grid no longer contains, and only if empty.
  delete from gema.event_slots s
  where s.event_id = p_event_id
    and s.seats_taken = 0
    and not exists (
      select 1
      from generate_series(v_event.starts_at, v_event.ends_at - v_step, v_step) as g
      where g = s.starts_at
    );

  insert into gema.event_slots (event_id, starts_at, ends_at, seats_total, closed)
  select
    p_event_id,
    g,
    g + v_step,
    p_seats_per_slot,
    -- Break windows are born closed. Compared as wall-clock in the event's
    -- timezone, never UTC — 12:00 in Manila is 04:00 UTC.
    p_break_start is not null
      and p_break_end is not null
      and (g at time zone v_event.timezone)::time >= p_break_start
      and (g at time zone v_event.timezone)::time < p_break_end
  from generate_series(v_event.starts_at, v_event.ends_at - v_step, v_step) as g
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
      capacity = v_seats
  where id = p_event_id;

  return jsonb_build_object(
    'slots', v_slots,
    'seats', v_seats,
    'slot_minutes', p_slot_minutes
  );
end;
$$;

grant execute on function gema.generate_event_slots(uuid, integer, integer, time, time)
  to authenticated, service_role;

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
-- 6) Registration, with the slot claim
--
-- Recreated from remove_registration_city.sql with one extra argument. The
-- referral -> sponsor resolution and the sponsorless-lead host fallback are
-- carried over verbatim; the only additions are the slot claim and the slot on
-- the registration row.
--
-- The claim is a conditional UPDATE. Postgres takes a row lock on the matched
-- slot, so two guests racing the same window serialise: the loser matches zero
-- rows and is told the window has gone. No advisory lock, no retry loop.
-- ---------------------------------------------------------------------------
drop function if exists gema.register_prospect_for_event(uuid, text, text, text, boolean, boolean, uuid, uuid, text, text, text);

create function gema.register_prospect_for_event(
  p_event_id uuid,
  p_full_name text,
  p_phone text,
  p_email text,
  p_consent_privacy boolean,
  p_consent_marketing boolean,
  p_prospect_id uuid,
  p_registration_id uuid,
  p_pass_code text,
  p_qr_payload text,
  p_ref_code text default null,
  p_slot_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'gema', 'public'
as $$
declare
  v_event gema.events;
  v_referral gema.referrals;
  v_referral_id uuid := null;
  v_sponsor uuid := null;
  v_source public.registration_source := 'public_invite';
  v_count integer;
  v_slot gema.event_slots;
  v_claimed uuid;
begin
  if not p_consent_privacy then
    raise exception 'Privacy consent is required' using errcode = 'check_violation';
  end if;

  select * into v_event from gema.events where id = p_event_id;
  if not found then
    raise exception 'Event not found' using errcode = 'no_data_found';
  end if;

  if p_ref_code is not null and length(trim(p_ref_code)) > 0 then
    select * into v_referral
    from gema.referrals
    where ref_code = p_ref_code
      and status in ('active', 'claimed')
      and (expires_at is null or expires_at > now());
    if found then
      v_referral_id := v_referral.id;
      v_source := 'member_referral';
      if v_referral.referrer_member_id is not null then
        v_sponsor := v_referral.referrer_member_id;
      else
        select sponsor_member_id into v_sponsor
        from gema.prospects
        where id = v_referral.referrer_prospect_id;

        if v_sponsor is null then
          v_sponsor := v_event.host_member_id;
        end if;
      end if;
    end if;
  end if;

  if v_event.status <> 'published'
    or coalesce(v_event.ends_at, v_event.starts_at) < now() then
    raise exception 'Event is not open for registration' using errcode = 'check_violation';
  end if;

  if v_event.scheduling_enabled then
    -- No walk-ins. A scheduled event is booked by window or not at all.
    if p_slot_id is null then
      raise exception 'Pick an arrival time' using errcode = 'check_violation';
    end if;

    update gema.event_slots
    set seats_taken = seats_taken + 1
    where id = p_slot_id
      and event_id = p_event_id
      and not closed
      and ends_at > now()
      and seats_taken < seats_total
    returning id into v_claimed;

    if v_claimed is null then
      raise exception 'That arrival time has just been taken' using errcode = 'check_violation';
    end if;

    select * into v_slot from gema.event_slots where id = v_claimed;
  else
    if p_slot_id is not null then
      raise exception 'This event does not use arrival times' using errcode = 'check_violation';
    end if;

    -- Unscheduled events keep the flat counter. On a scheduled event the grid
    -- is the cap and this check would double-count.
    if v_event.capacity is not null then
      select count(*) into v_count
      from gema.event_registrations
      where event_id = p_event_id and status <> 'cancelled';
      if v_count >= v_event.capacity then
        raise exception 'Event is at full capacity' using errcode = 'check_violation';
      end if;
    end if;
  end if;

  insert into gema.prospects (
    id, sponsor_member_id, full_name, phone, email, stage, source,
    consent_privacy, consent_marketing, metadata
  )
  values (
    p_prospect_id, v_sponsor, p_full_name, nullif(p_phone, ''), nullif(p_email, ''),
    'registered', v_source::text, p_consent_privacy, p_consent_marketing,
    '{}'::jsonb
  );

  insert into gema.event_registrations (
    id, event_id, prospect_id, referral_id, sponsor_member_id,
    registration_kind, status, source, pass_code, qr_payload,
    attendee_name, attendee_phone, attendee_email,
    consent_privacy, consent_marketing, slot_id, metadata
  )
  values (
    p_registration_id, p_event_id, p_prospect_id, v_referral_id, v_sponsor,
    'prospect', 'registered', v_source, p_pass_code, p_qr_payload,
    p_full_name, nullif(p_phone, ''), nullif(p_email, ''),
    p_consent_privacy, p_consent_marketing, v_claimed, '{}'::jsonb
  );

  if v_referral_id is not null then
    update gema.referrals
    set status = case when status = 'active' then 'claimed' else status end,
        prospect_id = coalesce(prospect_id, p_prospect_id),
        claimed_at = coalesce(claimed_at, now())
    where id = v_referral_id;
  end if;

  return jsonb_build_object(
    'registration_id', p_registration_id,
    'prospect_id', p_prospect_id,
    'pass_code', p_pass_code,
    'slot_id', v_claimed,
    'slot_starts_at', v_slot.starts_at,
    'slot_ends_at', v_slot.ends_at
  );
end;
$$;

grant execute on function gema.register_prospect_for_event(uuid, text, text, text, boolean, boolean, uuid, uuid, text, text, text, uuid)
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
