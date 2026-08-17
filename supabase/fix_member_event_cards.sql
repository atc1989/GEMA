-- Restore get_member_event_cards after the gema move rewrite dropped ends_at
-- and sorted oldest-first. Members then classified in-progress events as past
-- (hasEnded falls back to starts_at) and All Events looked empty.
--
-- Also treat published company_support events like public for SELECT, matching
-- get_member_event_cards / register_member_for_event.

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
