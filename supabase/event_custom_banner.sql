-- Custom event banners (upload-your-own) plus the RPCs event creation needs.
--
-- Apply to STAGING (fxdsnacuonfvutdquogb, schema gema) first.
-- Re-runnable later on Lifestyle (rvwseybgimmewuoccecu): CREATE OR REPLACE
-- and DROP POLICY IF EXISTS, so the same file is the Lifestyle promote step.
--
-- Does not touch doctors or sandbox.
-- create_member_event / event_slug_exists signatures match Lifestyle gema.

-- ---------------------------------------------------------------------------
-- 1) Public storage bucket for speaker photos and custom event banners
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('event-photos', 'event-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "event_photos_public_read" on storage.objects;
create policy "event_photos_public_read"
on storage.objects for select
using (bucket_id = 'event-photos');

drop policy if exists "event_photos_auth_insert" on storage.objects;
create policy "event_photos_auth_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'event-photos');

drop policy if exists "event_photos_auth_update" on storage.objects;
create policy "event_photos_auth_update"
on storage.objects for update
to authenticated
using (bucket_id = 'event-photos' and owner = auth.uid());

drop policy if exists "event_photos_auth_delete" on storage.objects;
create policy "event_photos_auth_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'event-photos' and owner = auth.uid());

-- ---------------------------------------------------------------------------
-- 2) event_slug_exists — copied from Lifestyle gema (same signature)
-- ---------------------------------------------------------------------------
create or replace function gema.event_slug_exists(
  p_slug text,
  p_ignore_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path to 'gema', 'public'
as $$
  select exists (
    select 1 from gema.events
    where slug = p_slug
      and (p_ignore_id is null or id <> p_ignore_id)
  );
$$;

grant execute on function gema.event_slug_exists(text, uuid)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) create_member_event — copied from Lifestyle gema (same signature)
--    public/private publish immediately when can_publish_events;
--    company_support always stays draft until an admin publishes.
-- ---------------------------------------------------------------------------
create or replace function gema.create_member_event(
  p_title text,
  p_slug text,
  p_event_type event_type,
  p_visibility event_visibility,
  p_mode event_mode,
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
set search_path to 'gema', 'public'
as $$
declare
  v_profile_id uuid := auth.uid();
  v_member gema.members%rowtype;
  v_can_publish_events boolean := false;
  v_event_id uuid;
  v_speaker_name text := nullif(btrim(coalesce(p_speaker_name, '')), '');
begin
  if v_profile_id is null then
    raise exception 'not authenticated';
  end if;

  select * into v_member
  from gema.members
  where profile_id = v_profile_id
    and status = 'active'
  limit 1;

  if v_member.id is null then
    raise exception 'only active members can create events';
  end if;

  select coalesce(can_publish_events, false) into v_can_publish_events
  from gema.profiles
  where id = v_profile_id;

  insert into gema.events (
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
      when p_visibility = 'company_support' then 'draft'::event_status
      when v_can_publish_events then 'published'::event_status
      else 'draft'::event_status
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
    insert into gema.event_speakers (
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

grant execute on function gema.create_member_event(
  text, text, event_type, event_visibility, event_mode, timestamptz, timestamptz,
  text, text, text, text, text, integer, text, text, text, text, text, jsonb
) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) get_invite_event — copied from Lifestyle gema (same signature)
--    Public invite page needs this to render the custom or maker banner.
-- ---------------------------------------------------------------------------
create or replace function gema.get_invite_event(
  p_event_id uuid,
  p_ref_code text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'gema', 'public'
as $$
declare
  v_event gema.events;
  v_speakers jsonb;
begin
  select * into v_event from gema.events where id = p_event_id;
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
  from gema.event_speakers s
  where s.event_id = p_event_id;

  return jsonb_build_object('event', to_jsonb(v_event), 'speakers', v_speakers);
end;
$$;

grant execute on function gema.get_invite_event(uuid, text)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5) Auth signup -> gema.profiles, plus member onboarding RPCs
--    Copied from Lifestyle so staging test users can sign up and become members.
--    onboard_member signature matches Lifestyle (p_username, p_sponsor_ref).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  insert into gema.profiles (id, email, first_name, last_name, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(trim(concat_ws(' ',
        new.raw_user_meta_data ->> 'first_name',
        new.raw_user_meta_data ->> 'last_name')), ''),
      nullif(new.raw_user_meta_data ->> 'username', ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

grant execute on function public.handle_new_user()
  to anon, authenticated, service_role;

create or replace function gema.link_member_genealogy(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path to 'gema', 'public'
as $$
declare
  v_sponsor uuid;
begin
  insert into gema.genealogy (ancestor_member_id, descendant_member_id, depth)
  values (p_member_id, p_member_id, 0)
  on conflict do nothing;

  select sponsor_member_id into v_sponsor from gema.members where id = p_member_id;

  if v_sponsor is not null then
    insert into gema.genealogy (ancestor_member_id, descendant_member_id, depth)
    select g.ancestor_member_id, p_member_id, g.depth + 1
    from gema.genealogy g
    where g.descendant_member_id = v_sponsor
    on conflict do nothing;
  end if;
end;
$$;

grant execute on function gema.link_member_genealogy(uuid)
  to anon, authenticated, service_role;

create or replace function gema.onboard_member(
  p_username text,
  p_sponsor_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'gema', 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_existing gema.members;
  v_username citext := nullif(trim(p_username), '')::citext;
  v_sponsor uuid := null;
  v_code text;
  v_attempt int := 0;
begin
  if v_uid is null then
    raise exception 'You must be signed in' using errcode = '42501';
  end if;

  select * into v_existing from gema.members where profile_id = v_uid;
  if found then
    return jsonb_build_object(
      'member_id', v_existing.id,
      'member_code', v_existing.member_code,
      'username', v_existing.username
    );
  end if;

  if v_username is null or length(v_username) < 3 then
    raise exception 'Username must be at least 3 characters' using errcode = 'check_violation';
  end if;
  if exists (select 1 from gema.members where username = v_username) then
    raise exception 'That username is already taken' using errcode = 'unique_violation';
  end if;

  if p_sponsor_ref is not null and length(trim(p_sponsor_ref)) > 0 then
    select referrer_member_id into v_sponsor
    from gema.referrals
    where ref_code = trim(p_sponsor_ref) and status in ('active', 'claimed')
    limit 1;
    if v_sponsor is null then
      select id into v_sponsor
      from gema.members where username = trim(p_sponsor_ref)::citext limit 1;
    end if;
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := 'M' || to_char(now(), 'YYMMDD') || upper(substr(md5(gen_random_uuid()::text), 1, 5));
    exit when not exists (select 1 from gema.members where member_code = v_code);
    if v_attempt >= 8 then
      raise exception 'Could not allocate a member code, please retry';
    end if;
  end loop;

  insert into gema.members (
    profile_id, sponsor_member_id, member_code, username, status, joined_at, activated_at
  )
  values (v_uid, v_sponsor, v_code, v_username, 'active', now(), now())
  returning * into v_existing;

  perform gema.link_member_genealogy(v_existing.id);

  return jsonb_build_object(
    'member_id', v_existing.id,
    'member_code', v_existing.member_code,
    'username', v_existing.username
  );
end;
$$;

grant execute on function gema.onboard_member(text, text)
  to anon, authenticated, service_role;
