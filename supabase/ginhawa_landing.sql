-- Ginhawa landing CMS: one published snapshot that the public Ginhawa app reads.
--
-- Apply to STAGING (fxdsnacuonfvutdquogb, schema gema) first.
-- Re-runnable later on Lifestyle (rvwseybgimmewuoccecu): CREATE OR REPLACE
-- and DROP POLICY IF EXISTS, so the same file is the Lifestyle promote step.
--
-- Ginhawa copy is a snapshot of a GEMA event plus landing-only fields.
-- Publishing here does not mutate gema.events.

-- ---------------------------------------------------------------------------
-- 1) Singleton table
-- ---------------------------------------------------------------------------
create table if not exists gema.ginhawa_landing (
  id boolean primary key default true check (id),
  source_event_id uuid not null references gema.events(id) on delete restrict,
  title text not null,
  date_label text not null,
  time_label text not null,
  hero_what text not null default '',
  gift_points integer not null default 750 check (gift_points >= 0),
  gift_peso integer not null default 750 check (gift_peso >= 0),
  capacity integer check (capacity is null or capacity > 0),
  clinicians jsonb not null default '[]'::jsonb,
  video_url text,
  video_length text,
  video_caption text,
  ask_title text not null default '',
  ask_body text not null default '',
  ask_hit text not null default '',
  gut_title text not null default '',
  gut_body text not null default '',
  gut_close text not null default '',
  venue_name text,
  venue_address text,
  map_url text,
  published boolean not null default false,
  published_at timestamptz,
  updated_by uuid references gema.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ginhawa_landing_clinicians_shape check (
    jsonb_typeof(clinicians) = 'array'
    and jsonb_array_length(clinicians) <= 4
  )
);

create index if not exists ginhawa_landing_source_event_idx
  on gema.ginhawa_landing (source_event_id);

drop trigger if exists ginhawa_landing_set_updated_at on gema.ginhawa_landing;
create trigger ginhawa_landing_set_updated_at
before update on gema.ginhawa_landing
for each row execute function gema.set_updated_at();

grant all on table gema.ginhawa_landing to anon, authenticated, service_role;

alter table gema.ginhawa_landing enable row level security;

drop policy if exists ginhawa_landing_select_published on gema.ginhawa_landing;
create policy ginhawa_landing_select_published
on gema.ginhawa_landing for select
using (published = true or gema.is_admin());

drop policy if exists ginhawa_landing_admin_write on gema.ginhawa_landing;
create policy ginhawa_landing_admin_write
on gema.ginhawa_landing for all
using (gema.is_admin())
with check (gema.is_admin());

-- ---------------------------------------------------------------------------
-- 2) Public read: published snapshot + live seat count
--    security definer so Ginhawa (anon) never needs SELECT on registrations.
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
  v_taken integer := 0;
begin
  select * into v_row
  from gema.ginhawa_landing
  where id = true and published = true;

  if not found then
    return null;
  end if;

  select count(*)::integer into v_taken
  from gema.event_registrations
  where event_id = v_row.source_event_id
    and status <> 'cancelled';

  return jsonb_build_object(
    'source_event_id', v_row.source_event_id,
    'title', v_row.title,
    'date_label', v_row.date_label,
    'time_label', v_row.time_label,
    'hero_what', v_row.hero_what,
    'gift_points', v_row.gift_points,
    'gift_peso', v_row.gift_peso,
    'capacity', v_row.capacity,
    'clinicians', v_row.clinicians,
    'video_url', v_row.video_url,
    'video_length', v_row.video_length,
    'video_caption', v_row.video_caption,
    'ask_title', v_row.ask_title,
    'ask_body', v_row.ask_body,
    'ask_hit', v_row.ask_hit,
    'gut_title', v_row.gut_title,
    'gut_body', v_row.gut_body,
    'gut_close', v_row.gut_close,
    'venue_name', v_row.venue_name,
    'venue_address', v_row.venue_address,
    'map_url', v_row.map_url,
    'published_at', v_row.published_at,
    'seats_taken', v_taken
  );
end;
$$;

revoke all on function gema.get_ginhawa_landing() from public;
grant execute on function gema.get_ginhawa_landing()
  to anon, authenticated, service_role;
