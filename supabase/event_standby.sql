-- Standby list for a full clinic.
--
-- Apply to STAGING (fxdsnacuonfvutdquogb, schema gema) first, then PRODUCTION
-- (rvwseybgimmewuoccecu). Re-runnable. Run after event_slot_scheduling_step2.sql.
--
-- SAFE ON A LIVE DATABASE, unlike the slots migration's step 2. That one had to
-- be split because register_prospect_for_event kept changing shape; here the
-- 12-argument signature is replaced by a 14-argument one whose two new
-- arguments default, and only one function exists afterwards. PostgREST matches
-- on argument NAMES, so a deployed app sending the old twelve still resolves —
-- the names it sends are a subset and the rest default. (What genuinely breaks
-- a running app is REMOVING a name it sends, which is what happened when p_city
-- went away.)
--
-- Model:
--   * When every window is taken, a guest joins a STANDBY list rather than
--     being turned away. They get a pass, a queue position and no fixed time.
--   * Standby is capped per event. An uncapped list is how two hundred people
--     turn up to a hall with twenty-eight chairs.
--   * Queue position is DERIVED from registered_at, not stored. A cancellation
--     renumbers everybody behind it, which is what a queue should do.
--   * On a multi-day run, standby still picks a DAY. Without one a standby
--     guest belongs to neither Friday nor Saturday and falls out of every
--     per-day count.
--   * Marking a booked guest a no-show frees their window. That is what makes
--     the standby list actually move.

-- ---------------------------------------------------------------------------
-- 1) Standby settings on the event
-- ---------------------------------------------------------------------------
alter table gema.events
  add column if not exists standby_enabled boolean not null default false,
  add column if not exists standby_limit integer;

alter table gema.events drop constraint if exists events_standby_limit_check;
alter table gema.events
  add constraint events_standby_limit_check
  check (standby_limit is null or standby_limit between 1 and 500);

-- ---------------------------------------------------------------------------
-- 2) Standby on the registration
--
-- `standby` is explicit rather than inferred from a null slot_id: an
-- unscheduled event has null slots for everyone, and those guests are booked,
-- not waiting.
-- ---------------------------------------------------------------------------
alter table gema.event_registrations
  add column if not exists standby boolean not null default false,
  add column if not exists standby_day date;

alter table gema.event_registrations drop constraint if exists event_registrations_standby_shape;
alter table gema.event_registrations
  add constraint event_registrations_standby_shape
  -- A standby guest holds no window; a scheduled one has no standby day.
  check (not standby or slot_id is null);

-- Queue order is registered_at within an event and day, so that is the index.
create index if not exists event_registrations_standby_idx
  on gema.event_registrations (event_id, standby_day, registered_at)
  where standby;

-- ---------------------------------------------------------------------------
-- 3) Where a guest stands in the queue
--
-- Derived, never stored. Cancel number three and number four becomes three,
-- which is the only behaviour a queue can have without going stale.
-- ---------------------------------------------------------------------------
create or replace function gema.standby_position(p_registration_id uuid)
returns integer
language sql
stable
security definer
set search_path to 'gema', 'public'
as $$
  with me as (
    select event_id, standby_day, registered_at
    from gema.event_registrations
    where id = p_registration_id and standby and status <> 'cancelled'
  )
  select count(*)::integer + 1
  from gema.event_registrations r, me
  where r.event_id = me.event_id
    and r.standby
    and r.status <> 'cancelled'
    and r.standby_day is not distinct from me.standby_day
    and r.registered_at < me.registered_at;
$$;

grant execute on function gema.standby_position(uuid)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) Registration, with the standby path
--
-- Recreated from event_slot_scheduling_step2.sql with two extra arguments. The
-- referral -> sponsor resolution, the host fallback and the slot claim are
-- carried over unchanged.
-- ---------------------------------------------------------------------------
drop function if exists gema.register_prospect_for_event(uuid, text, text, text, boolean, boolean, uuid, uuid, text, text, text, uuid);

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
  p_slot_id uuid default null,
  -- Joining the queue instead of taking a window.
  p_standby boolean default false,
  -- Which day of the run they intend to come. Ignored on a single-day event.
  p_standby_day date default null
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
  v_claimed uuid := null;
  v_standby boolean := false;
  v_standby_day date := null;
  v_rank integer := null;
  v_limit integer;
  v_first_day date;
  v_last_day date;
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

  if p_standby and not coalesce(v_event.standby_enabled, false) then
    raise exception 'This event has no standby list' using errcode = 'check_violation';
  end if;

  if p_standby then
    if p_slot_id is not null then
      raise exception 'A standby guest cannot also hold an arrival time'
        using errcode = 'check_violation';
    end if;

    -- The day, in the event's own timezone. A one-day event does not need one;
    -- a run does, or this guest lands in nobody's count.
    v_first_day := (v_event.starts_at at time zone v_event.timezone)::date;
    v_last_day := (coalesce(v_event.ends_at, v_event.starts_at)
                     at time zone v_event.timezone)::date;

    if v_first_day = v_last_day then
      v_standby_day := v_first_day;
    else
      if p_standby_day is null then
        raise exception 'Pick the day you are coming' using errcode = 'check_violation';
      end if;
      if p_standby_day < v_first_day or p_standby_day > v_last_day then
        raise exception 'That day is not part of this event' using errcode = 'check_violation';
      end if;
      v_standby_day := p_standby_day;
    end if;

    -- Counting then inserting is a check-then-act, and unlike the slot claim
    -- there is no single row to lock. One lock per event, held to commit, so two
    -- guests racing the last standby place serialise instead of both getting in.
    perform pg_advisory_xact_lock(hashtextextended(p_event_id::text, 0));

    v_limit := coalesce(v_event.standby_limit, 80);

    select count(*) into v_count
    from gema.event_registrations
    where event_id = p_event_id
      and standby
      and status <> 'cancelled'
      and standby_day is not distinct from v_standby_day;

    if v_count >= v_limit then
      raise exception 'The standby list is full' using errcode = 'check_violation';
    end if;

    v_standby := true;
    v_rank := v_count + 1;

  elsif v_event.scheduling_enabled then
    -- A scheduled event is booked by window, or by standby, or not at all.
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
      where event_id = p_event_id and status <> 'cancelled' and not standby;
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
    consent_privacy, consent_marketing, slot_id, standby, standby_day, metadata
  )
  values (
    p_registration_id, p_event_id, p_prospect_id, v_referral_id, v_sponsor,
    'prospect', 'registered', v_source, p_pass_code, p_qr_payload,
    p_full_name, nullif(p_phone, ''), nullif(p_email, ''),
    p_consent_privacy, p_consent_marketing, v_claimed, v_standby, v_standby_day,
    '{}'::jsonb
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
    'slot_ends_at', v_slot.ends_at,
    'standby', v_standby,
    'standby_day', v_standby_day,
    'standby_rank', v_rank
  );
end;
$$;

grant execute on function gema.register_prospect_for_event(
  uuid, text, text, text, boolean, boolean, uuid, uuid, text, text, text, uuid, boolean, date
) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5) A no-show frees its window too
--
-- The release trigger only fired on 'cancelled'. Marking a guest a no-show left
-- their window locked, which would have made the standby list a queue that
-- never moves — the whole point of having one.
-- ---------------------------------------------------------------------------
create or replace function gema.event_registration_release_slot()
returns trigger
language plpgsql
security definer
set search_path to 'gema', 'public'
as $$
declare
  -- Statuses that mean the chair is free again.
  v_was_free boolean;
  v_is_free boolean;
begin
  if tg_op = 'DELETE' then
    if old.slot_id is not null then
      update gema.event_slots
      set seats_taken = greatest(seats_taken - 1, 0)
      where id = old.slot_id;
    end if;
    return old;
  end if;

  v_was_free := old.status in ('cancelled', 'no_show');
  v_is_free := new.status in ('cancelled', 'no_show');

  if old.slot_id is not null and not v_was_free and v_is_free then
    update gema.event_slots
    set seats_taken = greatest(seats_taken - 1, 0)
    where id = old.slot_id;
  end if;

  -- Undoing a no-show or a cancellation has to re-take the window, and by then
  -- somebody from the standby list may be sitting in it.
  if new.slot_id is not null and v_was_free and not v_is_free then
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

-- ---------------------------------------------------------------------------
-- 6) Public availability carries the standby state
--
-- The landing needs to know whether to offer the queue, and whether the queue
-- itself is full. Counts only — never a name.
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
    'standby_enabled', coalesce(v_event.standby_enabled, false),
    'standby_limit', coalesce(v_event.standby_limit, 80),
    'standby_counts', coalesce(
      (
        select jsonb_object_agg(day_key, waiting)
        from (
          select
            coalesce(to_char(r.standby_day, 'YYYY-MM-DD'), 'all') as day_key,
            count(*)::integer as waiting
          from gema.event_registrations r
          where r.event_id = p_event_id
            and r.standby
            and r.status <> 'cancelled'
          group by 1
        ) counts
      ),
      '{}'::jsonb
    ),
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
