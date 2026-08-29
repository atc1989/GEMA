-- Landing media carousel: up to three videos/images per landing.
-- Replaces the single video_url/video_caption pair. The old columns stay for
-- rows saved before this change; the app falls back to them when media is
-- empty and writes media on the next edit.
-- Apply to STAGING (fxdsnacuonfvutdquogb) first, then Production (rvwseybgimmewuoccecu).

alter table gema.ginhawa_landing
  add column if not exists media jsonb not null default '[]'::jsonb;

-- Backfill the existing single video so published landings keep their slide
-- without waiting for a host to re-save.
update gema.ginhawa_landing
set media = jsonb_build_array(
  jsonb_build_object('url', video_url, 'caption', coalesce(video_caption, ''))
)
where media = '[]'::jsonb
  and coalesce(trim(video_url), '') <> '';

-- Public payload: hand `media` to the landing templates.
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
    'media', p_row.media,
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
