-- Adds admin-controlled member self-publishing permission for events.
-- Run this after the base existing-project migration and member_events_experience.sql.

alter table public.profiles
  add column if not exists can_publish_events boolean not null default false;

update public.profiles
set can_publish_events = false
where can_publish_events is null;

alter table public.profiles
  alter column can_publish_events set default false,
  alter column can_publish_events set not null;

create or replace function public.prevent_member_event_permission_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.can_publish_events is distinct from new.can_publish_events
     and auth.role() <> 'service_role'
     and not public.is_admin() then
    raise exception 'Only administrators can change event publishing permissions.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_member_event_permission_self_update on public.profiles;
create trigger profiles_prevent_member_event_permission_self_update
before update of can_publish_events on public.profiles
for each row execute function public.prevent_member_event_permission_self_update();

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid() and is_admin = false);

create or replace function public.update_member_event_publishing_permission(
  p_member_id uuid,
  p_can_publish_events boolean
)
returns table (
  member_id uuid,
  member_name text,
  can_publish_events boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.members%rowtype;
  v_profile public.profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can change event publishing permissions.';
  end if;

  select * into v_member
  from public.members
  where id = p_member_id
  limit 1;

  if v_member.id is null then
    raise exception 'Member not found.';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_member.profile_id
  limit 1;

  if v_profile.id is null then
    raise exception 'Member profile not found.';
  end if;

  if v_profile.is_admin = true or v_profile.role = 'admin' then
    raise exception 'Administrator accounts are not eligible for member publishing access.';
  end if;

  update public.profiles
  set can_publish_events = p_can_publish_events
  where id = v_profile.id
  returning * into v_profile;

  member_id := v_member.id;
  member_name := coalesce(
    nullif(btrim(v_profile.full_name), ''),
    nullif(btrim(v_profile.email::text), ''),
    nullif(btrim(v_member.username::text), ''),
    nullif(btrim(v_member.member_code), ''),
    'Member'
  );
  can_publish_events := v_profile.can_publish_events;
  return next;
end;
$$;

grant execute on function public.update_member_event_publishing_permission(uuid, boolean) to authenticated;

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
  v_can_publish_events boolean := false;
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

  select coalesce(can_publish_events, false) into v_can_publish_events
  from public.profiles
  where id = v_profile_id;

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
    case
      when p_visibility = 'company_support' then 'draft'::public.event_status
      when v_can_publish_events then 'published'::public.event_status
      else 'draft'::public.event_status
    end,
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
