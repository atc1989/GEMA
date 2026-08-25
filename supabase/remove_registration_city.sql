-- Drop the city field from public prospect registration.
--
-- p_city was write-only: it landed in prospects.metadata / event_registrations.metadata
-- as {"city": ...} and nothing ever read it back. Removing a parameter needs a real
-- drop (create or replace would leave the 12-arg overload callable), so the old
-- signature is dropped and the function recreated with 11 args.
--
-- Deploy order: run this SQL BEFORE shipping the app change. The old app code sends
-- p_city and would get PGRST202 against the new signature, so keep the window short.

drop function if exists gema.register_prospect_for_event(uuid, text, text, text, text, boolean, boolean, uuid, uuid, text, text, text);

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
  p_ref_code text default null
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

  if v_event.capacity is not null then
    select count(*) into v_count
    from gema.event_registrations
    where event_id = p_event_id and status <> 'cancelled';
    if v_count >= v_event.capacity then
      raise exception 'Event is at full capacity' using errcode = 'check_violation';
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
    consent_privacy, consent_marketing, metadata
  )
  values (
    p_registration_id, p_event_id, p_prospect_id, v_referral_id, v_sponsor,
    'prospect', 'registered', v_source, p_pass_code, p_qr_payload,
    p_full_name, nullif(p_phone, ''), nullif(p_email, ''),
    p_consent_privacy, p_consent_marketing, '{}'::jsonb
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
    'pass_code', p_pass_code
  );
end;
$$;

grant execute on function gema.register_prospect_for_event(uuid, text, text, text, boolean, boolean, uuid, uuid, text, text, text)
  to anon, authenticated, service_role;
