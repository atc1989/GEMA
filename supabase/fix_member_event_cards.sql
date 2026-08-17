-- Restore get_member_event_cards after the gema move rewrite dropped ends_at
-- and sorted oldest-first. Members then classified in-progress events as past
-- (hasEnded falls back to starts_at) and All Events looked empty.
--
-- Also treat published company_support events like public for SELECT, matching
-- get_member_event_cards / register_member_for_event.
--
-- The same rewrite dropped the finished-event RSVP guard on
-- register_member_for_event / register_prospect_for_event, and left insert RLS
-- on visibility = public only. Those are restored below.

drop function if exists gema.get_member_event_cards(text, integer);

create function gema.get_member_event_cards(
  p_search text default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  title text,
  event_type event_type,
  visibility event_visibility,
  mode event_mode,
  status event_status,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text,
  venue_name text,
  online_url text,
  capacity integer,
  description text,
  speaker_name text,
  registered_count integer,
  member_registration_id uuid,
  member_registration_status registration_status,
  member_pass_code text,
  member_qr_payload text,
  pinned_at timestamptz
)
language plpgsql
security definer
set search_path to 'gema', 'public'
as $$
declare
  v_member_id uuid;
begin
  v_member_id := gema.current_member_id();

  if auth.uid() is null or v_member_id is null then
    raise exception 'not authenticated';
  end if;

  return query
  with visible_events as (
    select e.*
    from gema.events e
    where e.status = 'published'
      and (
        e.visibility in ('public', 'company_support')
        or e.host_member_id = v_member_id
        or exists (
          select 1
          from gema.event_registrations er
          where er.event_id = e.id
            and er.member_id = v_member_id
            and er.status <> 'cancelled'
        )
      )
      and (
        p_search is null
        or btrim(p_search) = ''
        or e.title ilike '%' || btrim(p_search) || '%'
        or coalesce(e.venue_name, '') ilike '%' || btrim(p_search) || '%'
      )
  ),
  registration_counts as (
    select er.event_id, count(*)::integer as registered_count
    from gema.event_registrations er
    where er.status <> 'cancelled'
      and er.event_id in (select ve.id from visible_events ve)
    group by er.event_id
  ),
  first_speakers as (
    select distinct on (es.event_id)
      es.event_id,
      es.name
    from gema.event_speakers es
    where es.event_id in (select ve.id from visible_events ve)
    order by es.event_id, es.sort_order, es.created_at
  )
  select
    e.id,
    e.title,
    e.event_type,
    e.visibility,
    e.mode,
    e.status,
    e.starts_at,
    e.ends_at,
    e.timezone,
    e.venue_name,
    e.online_url,
    e.capacity,
    e.description,
    fs.name as speaker_name,
    coalesce(rc.registered_count, 0) as registered_count,
    mr.id as member_registration_id,
    mr.status as member_registration_status,
    mr.pass_code as member_pass_code,
    mr.qr_payload as member_qr_payload,
    e.pinned_at
  from visible_events e
  left join registration_counts rc on rc.event_id = e.id
  left join first_speakers fs on fs.event_id = e.id
  left join gema.event_registrations mr
    on mr.event_id = e.id
   and mr.member_id = v_member_id
   and mr.status <> 'cancelled'
  order by e.pinned_at desc nulls last, e.starts_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
end;
$$;

grant execute on function gema.get_member_event_cards(text, integer)
  to anon, authenticated, service_role;

drop policy if exists events_select_published_public on gema.events;
create policy events_select_published_public on gema.events
for select
using (
  (status = 'published' and visibility in ('public', 'company_support'))
  or gema.can_manage_event(id)
);

drop policy if exists event_speakers_select_visible_events on gema.event_speakers;
create policy event_speakers_select_visible_events on gema.event_speakers
for select
using (
  exists (
    select 1
    from gema.events e
    where e.id = event_speakers.event_id
      and (
        (e.status = 'published' and e.visibility in ('public', 'company_support'))
        or gema.can_manage_event(e.id)
      )
  )
);

-- The gema rewrite also dropped the finished-event RSVP guard and left
-- insert RLS on visibility = public only. Same open/closed rule as above.

create or replace function gema.register_member_for_event(
  p_event_id uuid,
  p_registration_id uuid,
  p_pass_code text,
  p_qr_payload text
)
returns uuid
language plpgsql
security definer
set search_path to 'gema', 'public'
as $$
declare
  v_profile_id uuid := auth.uid();
  v_member gema.members%rowtype;
  v_profile gema.profiles%rowtype;
  v_event gema.events%rowtype;
  v_existing gema.event_registrations%rowtype;
  v_registered_count integer;
begin
  if v_profile_id is null then
    raise exception 'not authenticated';
  end if;

  select * into v_member
  from gema.members
  where profile_id = v_profile_id;

  if v_member.id is null or v_member.status <> 'active' then
    raise exception 'only active members can RSVP';
  end if;

  select * into v_event
  from gema.events
  where id = p_event_id
  for update;

  if v_event.id is null
    or v_event.status <> 'published'
    or v_event.visibility not in ('public', 'company_support')
    or v_event.cancelled_at is not null
    or coalesce(v_event.ends_at, v_event.starts_at) < now() then
    raise exception 'event is not open for registration';
  end if;

  select * into v_existing
  from gema.event_registrations
  where event_id = p_event_id
    and member_id = v_member.id
    and status <> 'cancelled'
  limit 1;

  if v_existing.id is not null then
    return v_existing.id;
  end if;

  if v_event.capacity is not null then
    select count(*)::integer into v_registered_count
    from gema.event_registrations
    where event_id = p_event_id
      and status <> 'cancelled';

    if v_registered_count >= v_event.capacity then
      raise exception 'event capacity reached';
    end if;
  end if;

  select * into v_profile
  from gema.profiles
  where id = v_profile_id;

  insert into gema.event_registrations (
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

grant execute on function gema.register_member_for_event(uuid, uuid, text, text)
  to authenticated, service_role;

create or replace function gema.register_prospect_for_event(
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
    jsonb_build_object('city', p_city)
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
    p_consent_privacy, p_consent_marketing, jsonb_build_object('city', p_city)
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

grant execute on function gema.register_prospect_for_event(uuid, text, text, text, text, boolean, boolean, uuid, uuid, text, text, text)
  to anon, authenticated, service_role;

drop policy if exists registrations_insert_public_or_member on gema.event_registrations;
create policy registrations_insert_public_or_member on gema.event_registrations
for insert
with check (
  exists (
    select 1 from gema.events e
    where e.id = event_id
      and e.status = 'published'
      and e.visibility in ('public', 'company_support')
      and coalesce(e.ends_at, e.starts_at) >= now()
  )
  and consent_privacy = true
  and status = 'registered'
  and attended_at is null
  and cancelled_at is null
);
