-- Company Support Events, once published, now behave like Public events for
-- viewing/registration: listed in the public /invite discovery page and
-- self-RSVP-able from the member dashboard. The only remaining difference is
-- at creation time — they always require admin approval before publishing,
-- regardless of the creating member's can_publish_events flag (see
-- create_member_event in member_event_publishing_permissions.sql).
--
-- This only updates register_member_for_event's self-RSVP gate; no other RPC
-- or RLS policy needs a matching change:
--   - get_invite_event / register_prospect_for_event (private_event_link_access.sql)
--     already ignore visibility entirely, only checking status = 'published'.
--   - registrations_insert_public_or_member (the direct-insert RLS policy) is
--     unused by the app today — all registration writes go through the
--     SECURITY DEFINER RPCs above, which bypass RLS.

create or replace function public.register_member_for_event(
  p_event_id uuid,
  p_registration_id uuid,
  p_pass_code text,
  p_qr_payload text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := auth.uid();
  v_member public.members%rowtype;
  v_profile public.profiles%rowtype;
  v_event public.events%rowtype;
  v_existing public.event_registrations%rowtype;
  v_registered_count integer;
begin
  if v_profile_id is null then
    raise exception 'not authenticated';
  end if;

  select * into v_member
  from public.members
  where profile_id = v_profile_id;

  if v_member.id is null or v_member.status <> 'active' then
    raise exception 'only active members can RSVP';
  end if;

  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if v_event.id is null
    or v_event.status <> 'published'
    or v_event.visibility not in ('public', 'company_support')
    or v_event.cancelled_at is not null then
    raise exception 'event is not open for registration';
  end if;

  select * into v_existing
  from public.event_registrations
  where event_id = p_event_id
    and member_id = v_member.id
    and status <> 'cancelled'
  limit 1;

  if v_existing.id is not null then
    return v_existing.id;
  end if;

  if v_event.capacity is not null then
    select count(*)::integer into v_registered_count
    from public.event_registrations
    where event_id = p_event_id
      and status <> 'cancelled';

    if v_registered_count >= v_event.capacity then
      raise exception 'event capacity reached';
    end if;
  end if;

  select * into v_profile
  from public.profiles
  where id = v_profile_id;

  insert into public.event_registrations (
    id,
    event_id,
    profile_id,
    member_id,
    registration_kind,
    status,
    source,
    pass_code,
    qr_payload,
    attendee_name,
    attendee_phone,
    attendee_email,
    consent_privacy,
    consent_marketing
  )
  values (
    p_registration_id,
    p_event_id,
    v_profile_id,
    v_member.id,
    'member',
    'registered',
    'member_rsvp',
    p_pass_code,
    p_qr_payload,
    coalesce(nullif(v_profile.full_name, ''), v_member.username),
    v_profile.phone,
    v_profile.email,
    true,
    false
  );

  return p_registration_id;
end;
$$;
