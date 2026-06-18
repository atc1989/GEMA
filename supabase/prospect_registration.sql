-- GEMA Prospect Invite + Registration
-- Public (anonymous) registration write path. Anonymous users cannot read the
-- referrals table or read back their own inserts under RLS, so the write runs
-- through a single SECURITY DEFINER transaction. IDs, pass code, and the signed
-- qr_payload token are generated in the Next.js server action and passed in, so
-- HMAC signing stays where QR_SIGNING_SECRET lives.
--
-- Run once against the GEMA Supabase project (after schema.sql). Safe to re-run.

/*
 * resolve_invite_referral: read-only helper so the public landing page can show
 * an "Invited by {name}" note without exposing the referrals table to anon.
 * Returns { valid, inviter_name }.
 */
create or replace function public.resolve_invite_referral(p_ref_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if p_ref_code is null or length(trim(p_ref_code)) = 0 then
    return jsonb_build_object('valid', false, 'inviter_name', null);
  end if;

  select coalesce(p.full_name, m.username)
  into v_name
  from public.referrals r
  join public.members m on m.id = r.referrer_member_id
  left join public.profiles p on p.id = m.profile_id
  where r.ref_code = p_ref_code
    and r.status in ('active', 'claimed')
    and (r.expires_at is null or r.expires_at > now())
  limit 1;

  if v_name is null then
    return jsonb_build_object('valid', false, 'inviter_name', null);
  end if;

  return jsonb_build_object('valid', true, 'inviter_name', v_name);
end;
$$;

revoke all on function public.resolve_invite_referral(text) from public;
grant execute on function public.resolve_invite_referral(text) to anon, authenticated;

/*
 * register_prospect_for_event: atomically creates a prospect + an event
 * registration for a public event, linking the referral/inviter when a ref code
 * resolves. Validates the event is open and (if capacity is set) not full.
 *
 * IDs / pass_code / qr_payload are supplied by the caller (server action).
 * Returns { registration_id, prospect_id, pass_code }.
 * Raises on: missing consent, missing/closed event, full event.
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
  if v_event.status <> 'published' or v_event.visibility <> 'public' then
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

  -- Resolve referral / inviter attribution.
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

revoke all on function public.register_prospect_for_event(
  uuid, text, text, text, text, boolean, boolean, uuid, uuid, text, text, text
) from public;
grant execute on function public.register_prospect_for_event(
  uuid, text, text, text, text, boolean, boolean, uuid, uuid, text, text, text
) to anon, authenticated;
