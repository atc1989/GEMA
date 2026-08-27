-- Per-event Ginhawa/medical landings (replaces the singleton boolean PK).
--
-- Apply to STAGING (fxdsnacuonfvutdquogb, schema gema) first.
-- Re-runnable later on Lifestyle (rvwseybgimmewuoccecu).
--
-- After this:
--   - One landing row per event (unique source_event_id)
--   - template = 'medical' for now (more templates later)
--   - get_event_landing_by_slug / get_event_landing_by_event_id for GEMA /e/[slug]
--   - get_ginhawa_landing() still works for the legacy Ginhawa app
--     (returns the most recently published medical landing)

-- ---------------------------------------------------------------------------
-- 1) Migrate table: boolean singleton PK -> uuid PK, one row per event
-- ---------------------------------------------------------------------------
alter table gema.ginhawa_landing
  add column if not exists landing_id uuid,
  add column if not exists template text not null default 'medical';

update gema.ginhawa_landing
set landing_id = gen_random_uuid()
where landing_id is null;

alter table gema.ginhawa_landing
  alter column landing_id set default gen_random_uuid();

alter table gema.ginhawa_landing
  alter column landing_id set not null;

-- Drop the singleton boolean primary key / column if still present.
alter table gema.ginhawa_landing drop constraint if exists ginhawa_landing_pkey;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'gema'
      and table_name = 'ginhawa_landing'
      and column_name = 'id'
      and data_type = 'boolean'
  ) then
    alter table gema.ginhawa_landing drop column id;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'gema'
      and table_name = 'ginhawa_landing'
      and column_name = 'landing_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'gema'
      and table_name = 'ginhawa_landing'
      and column_name = 'id'
  ) then
    alter table gema.ginhawa_landing rename column landing_id to id;
  end if;
end $$;

alter table gema.ginhawa_landing drop constraint if exists ginhawa_landing_pkey;
alter table gema.ginhawa_landing add primary key (id);

alter table gema.ginhawa_landing drop constraint if exists ginhawa_landing_template_check;
alter table gema.ginhawa_landing
  add constraint ginhawa_landing_template_check
  check (template in ('medical'));

drop index if exists gema.ginhawa_landing_source_event_uidx;
create unique index ginhawa_landing_source_event_uidx
  on gema.ginhawa_landing (source_event_id);

create index if not exists ginhawa_landing_published_idx
  on gema.ginhawa_landing (published, published_at desc);

-- ---------------------------------------------------------------------------
-- 2) Shared JSON builder for public landing payloads
-- ---------------------------------------------------------------------------
create or replace function gema.ginhawa_landing_payload(p_row gema.ginhawa_landing)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'gema', 'public'
as $$
declare
  v_taken integer := 0;
  v_slug text;
begin
  select count(*)::integer into v_taken
  from gema.event_registrations
  where event_id = p_row.source_event_id
    and status <> 'cancelled';

  select e.slug into v_slug
  from gema.events e
  where e.id = p_row.source_event_id;

  return jsonb_build_object(
    'id', p_row.id,
    'source_event_id', p_row.source_event_id,
    'slug', v_slug,
    'template', p_row.template,
    'title', p_row.title,
    'date_label', p_row.date_label,
    'time_label', p_row.time_label,
    'hero_what', p_row.hero_what,
    'gift_points', p_row.gift_points,
    'gift_peso', p_row.gift_peso,
    'capacity', p_row.capacity,
    'clinicians', p_row.clinicians,
    'video_url', p_row.video_url,
    'video_length', p_row.video_length,
    'video_caption', p_row.video_caption,
    'ask_title', p_row.ask_title,
    'ask_body', p_row.ask_body,
    'ask_hit', p_row.ask_hit,
    'gut_title', p_row.gut_title,
    'gut_body', p_row.gut_body,
    'gut_close', p_row.gut_close,
    'venue_name', p_row.venue_name,
    'venue_address', p_row.venue_address,
    'map_url', p_row.map_url,
    'book_url', p_row.book_url,
    'published_at', p_row.published_at,
    'seats_taken', v_taken
  );
end;
$$;

revoke all on function gema.ginhawa_landing_payload(gema.ginhawa_landing) from public;

-- ---------------------------------------------------------------------------
-- 3) Legacy singleton reader: most recently published medical landing
-- ---------------------------------------------------------------------------
create or replace function gema.get_ginhawa_landing()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'gema', 'public'
as $$
declare
  v_row gema.ginhawa_landing;
begin
  select * into v_row
  from gema.ginhawa_landing
  where published = true
    and template = 'medical'
  order by published_at desc nulls last, updated_at desc
  limit 1;

  if not found then
    return null;
  end if;

  return gema.ginhawa_landing_payload(v_row);
end;
$$;

revoke all on function gema.get_ginhawa_landing() from public;
grant execute on function gema.get_ginhawa_landing()
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) Per-event public readers (GEMA /e/[slug])
-- ---------------------------------------------------------------------------
create or replace function gema.get_event_landing_by_slug(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'gema', 'public'
as $$
declare
  v_row gema.ginhawa_landing;
  v_event_id uuid;
begin
  if p_slug is null or length(trim(p_slug)) = 0 then
    return null;
  end if;

  select e.id into v_event_id
  from gema.events e
  where e.slug = trim(p_slug)
    and e.status = 'published'
  limit 1;

  if v_event_id is null then
    return null;
  end if;

  select * into v_row
  from gema.ginhawa_landing
  where source_event_id = v_event_id
    and published = true
  limit 1;

  if not found then
    return null;
  end if;

  return gema.ginhawa_landing_payload(v_row);
end;
$$;

revoke all on function gema.get_event_landing_by_slug(text) from public;
grant execute on function gema.get_event_landing_by_slug(text)
  to anon, authenticated, service_role;

create or replace function gema.get_event_landing_by_event_id(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'gema', 'public'
as $$
declare
  v_row gema.ginhawa_landing;
  v_ok boolean := false;
begin
  if p_event_id is null then
    return null;
  end if;

  select true into v_ok
  from gema.events e
  where e.id = p_event_id
    and e.status = 'published'
  limit 1;

  if not coalesce(v_ok, false) then
    return null;
  end if;

  select * into v_row
  from gema.ginhawa_landing
  where source_event_id = p_event_id
    and published = true
  limit 1;

  if not found then
    return null;
  end if;

  return gema.ginhawa_landing_payload(v_row);
end;
$$;

revoke all on function gema.get_event_landing_by_event_id(uuid) from public;
grant execute on function gema.get_event_landing_by_event_id(uuid)
  to anon, authenticated, service_role;
