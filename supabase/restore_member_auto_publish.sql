-- Restore create_member_event auto-publish after the gema rewrite always
-- inserted draft. Keep the member publishing permission:
--   public / private  -> published immediately when can_publish_events
--   company_support   -> always draft until an admin publishes

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
) to authenticated, service_role;
