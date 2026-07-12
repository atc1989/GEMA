-- =============================================================
-- Private events open via direct link (run after private_event_invite.sql)
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- Rule change: "private" now means UNLISTED. A published private event
-- is not shown on public listings, but anyone with the direct link or
-- event QR (/invite/<eventId>) can view it and register. A ref code is
-- no longer required to unlock the event — it only credits the inviter.
-- =============================================================

/*
 * get_invite_event: returns { event, speakers } for ANY published event.
 * p_ref_code kept for caller compatibility; no longer gates access.
 */
create or replace function public.get_invite_event(
  p_event_id uuid,
  p_ref_code text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_speakers jsonb;
begin
  select * into v_event from public.events where id = p_event_id;
  if not found or v_event.status <> 'published' then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'role_title', s.role_title,
        'photo_url', s.photo_url
      )
      order by s.sort_order
    ),
    '[]'::jsonb
  )
  into v_speakers
  from public.event_speakers s
  where s.event_id = p_event_id;

  return jsonb_build_object('event', to_jsonb(v_event), 'speakers', v_speakers);
end;
$$;

revoke all on function public.get_invite_event(uuid, text) from public;
grant execute on function public.get_invite_event(uuid, text) to anon, authenticated;

/*
 * register_prospect_for_event: same as private_event_invite.sql, except the
 * gate is now only status = 'published' — visibility no longer blocks
 * registration. Referral resolution is kept purely for attribution.
 */
create or replace function public.register_prospect_for_event(
  p_event_id uuid,
  p_full_name text,
  p_phone text,
  p_email text,
  p_city text,
  p_consent_privacy boolean,
  p_consent_marketing boolean,
  p_prospect_id uuid,
  p_registration_id uuid,
  p_pass_code text,
  p_qr_payload text,
  p_ref_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_referral public.referrals;
  v_referral_id uuid := null;
  v_sponsor uuid := null;
  v_source public.registration_source := 'public_invite';
  v_count integer;
begin
  if not p_consent_privacy then
    raise exception 'Privacy consent is required' using errcode = 'check_violation';
  end if;

  select * into v_event from public.events where id = p_event_id;
  if not found then
    raise exception 'Event not found' using errcode = 'no_data_found';
  end if;

  -- Referral is attribution-only now; it never gates registration.
  if p_ref_code is not null and length(trim(p_ref_code)) > 0 then
    select * into v_referral
    from public.referrals
    where ref_code = p_ref_code
      and status in ('active', 'claimed')
      and (expires_at is null or expires_at > now());
    if found then
      v_referral_id := v_referral.id;
      v_sponsor := v_referral.referrer_member_id;
      v_source := 'member_referral';
    end if;
  end if;

  if v_event.status <> 'published' then
    raise exception 'Event is not open for registration' using errcode = 'check_violation';
  end if;

  -- Capacity guard (race-safe within this transaction).
  if v_event.capacity is not null then
    select count(*) into v_count
    from public.event_registrations
    where event_id = p_event_id and status <> 'cancelled';
    if v_count >= v_event.capacity then
      raise exception 'Event is at full capacity' using errcode = 'check_violation';
    end if;
  end if;

  insert into public.prospects (
    id, sponsor_member_id, full_name, phone, email, stage, source,
    consent_privacy, consent_marketing, metadata
  )
  values (
    p_prospect_id, v_sponsor, p_full_name, nullif(p_phone, ''), nullif(p_email, ''),
    'registered', v_source::text, p_consent_privacy, p_consent_marketing,
    jsonb_build_object('city', p_city)
  );

  insert into public.event_registrations (
    id, event_id, prospect_id, referral_id, sponsor_member_id,
    registration_kind, status, source, pass_code, qr_payload,
    attendee_name, attendee_phone, attendee_email,
    consent_privacy, consent_marketing, metadata
  )
  values (
    p_registration_id, p_event_id, p_prospect_id, v_referral_id, v_sponsor,
    'prospect', 'registered', v_source, p_pass_code, p_qr_payload,
    p_full_name, nullif(p_phone, ''), nullif(p_email, ''),
    p_consent_privacy, p_consent_marketing, jsonb_build_object('city', p_city)
  );

  if v_referral_id is not null then
    update public.referrals
    set status = case when status = 'active' then 'claimed' else status end,
        prospect_id = coalesce(prospect_id, p_prospect_id),
        claimed_at = coalesce(claimed_at, now())
    where id = v_referral_id;
  end if;

  return jsonb_build_object(
    'registration_id', p_registration_id,
    'prospect_id', p_prospect_id,
    'pass_code', p_pass_code
  );
end;
$$;
