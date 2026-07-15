-- Member Events UX support.
-- Safe additive migration for the existing GEMA Supabase project.

create or replace function public.get_member_event_cards(
  p_search text default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  title text,
  event_type public.event_type,
  visibility public.event_visibility,
  mode public.event_mode,
  status public.event_status,
  starts_at timestamptz,
  timezone text,
  venue_name text,
  online_url text,
  capacity integer,
  description text,
  speaker_name text,
  registered_count integer,
  member_registration_id uuid,
  member_registration_status public.registration_status,
  member_pass_code text,
  member_qr_payload text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
begin
  v_member_id := public.current_member_id();

  if auth.uid() is null or v_member_id is null then
    raise exception 'not authenticated';
  end if;

  return query
  with visible_events as (
    select e.*
    from public.events e
    where e.status = 'published'
      and (
        e.visibility = 'public'
        -- private events only show to their host or invited (registered) members
        or e.host_member_id = v_member_id
        or exists (
          select 1
          from public.event_registrations er
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
    from public.event_registrations er
    where er.status <> 'cancelled'
      and er.event_id in (select ve.id from visible_events ve)
    group by er.event_id
  ),
  first_speakers as (
    select distinct on (es.event_id)
      es.event_id,
      es.name
    from public.event_speakers es
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
    mr.qr_payload as member_qr_payload
  from visible_events e
  left join registration_counts rc on rc.event_id = e.id
  left join first_speakers fs on fs.event_id = e.id
  left join public.event_registrations mr
    on mr.event_id = e.id
   and mr.member_id = v_member_id
   and mr.status <> 'cancelled'
  order by e.starts_at asc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
end;
$$;

create or replace function public.create_member_event(
  p_title text,
  p_slug text,
  p_event_type public.event_type,
  p_visibility public.event_visibility,
  p_mode public.event_mode,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_timezone text,
  p_venue_name text,
  p_venue_address text,
  p_map_url text,
  p_online_url text,
  p_capacity integer,
  p_description text,
  p_banner_url text,
  p_speaker_name text,
  p_speaker_photo_url text,
  p_poster_template text,
  p_photo_focus jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := auth.uid();
  v_member public.members%rowtype;
  v_event_id uuid;
  v_speaker_name text := nullif(btrim(coalesce(p_speaker_name, '')), '');
begin
  if v_profile_id is null then
    raise exception 'not authenticated';
  end if;

  select * into v_member
  from public.members
  where profile_id = v_profile_id
    and status = 'active'
  limit 1;

  if v_member.id is null then
    raise exception 'only active members can create events';
  end if;

  insert into public.events (
    created_by_profile_id,
    host_member_id,
    title,
    slug,
    event_type,
    visibility,
    mode,
    status,
    starts_at,
    ends_at,
    timezone,
    venue_name,
    venue_address,
    map_url,
    online_url,
    capacity,
    description,
    banner_url,
    metadata
  )
  values (
    v_profile_id,
    v_member.id,
    p_title,
    p_slug,
    p_event_type,
    p_visibility,
    p_mode,
    'draft',
    p_starts_at,
    p_ends_at,
    coalesce(nullif(btrim(p_timezone), ''), 'Asia/Manila'),
    p_venue_name,
    p_venue_address,
    p_map_url,
    p_online_url,
    p_capacity,
    p_description,
    p_banner_url,
    jsonb_build_object(
      'speakerName', v_speaker_name,
      'poster_template', p_poster_template,
      'photo_focus', coalesce(p_photo_focus, '{}'::jsonb)
    )
  )
  returning id into v_event_id;

  if v_speaker_name is not null or nullif(btrim(coalesce(p_speaker_photo_url, '')), '') is not null then
    insert into public.event_speakers (
      event_id,
      sort_order,
      name,
      photo_url
    )
    values (
      v_event_id,
      0,
      coalesce(v_speaker_name, 'Speaker'),
      nullif(btrim(coalesce(p_speaker_photo_url, '')), '')
    );
  end if;

  return v_event_id;
end;
$$;

grant execute on function public.create_member_event(
  text,
  text,
  public.event_type,
  public.event_visibility,
  public.event_mode,
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  jsonb
) to authenticated;

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
    or v_event.visibility <> 'public'
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
