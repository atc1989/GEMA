-- STEP 2 of 2 — replaces the live registration function. Apply AFTER the app
-- that carries the slot picker is deployed.
--
-- register_prospect_for_event goes from 11 arguments to 12. Both cannot exist
-- at once: PostgREST cannot choose between an 11-argument function and a
-- 12-argument one whose last argument has a default, so it refuses both. The
-- old signature is therefore dropped and the new one created in the same
-- transaction — other sessions block on the lock rather than erroring.
--
-- The app is built to survive either signature: it omits p_slot_id entirely
-- when no arrival window was picked, so an unscheduled booking resolves against
-- the old function and a scheduled one against the new. That is what makes this
-- file safe to run minutes or days after the deploy rather than at the same
-- instant.
--
-- Run event_slot_scheduling_step1.sql first. STAGING, then PRODUCTION.

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

