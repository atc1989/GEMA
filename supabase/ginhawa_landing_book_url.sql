-- Ginhawa landing: hero "Book my seat" URL (the GEMA registration form).
--
-- Apply to STAGING (fxdsnacuonfvutdquogb, schema gema) first.
-- Re-runnable later on Lifestyle (rvwseybgimmewuoccecu).

alter table gema.ginhawa_landing
  add column if not exists book_url text;

-- Existing published row: point the CTA at this event's public registration form.
-- Admin can change or clear the URL on the next publish.
update gema.ginhawa_landing
set book_url = 'https://gema-ivory.vercel.app/register/' || source_event_id::text
where book_url is null
  and source_event_id is not null;

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
    'book_url', v_row.book_url,
    'published_at', v_row.published_at,
    'seats_taken', v_taken
  );
end;
$$;

revoke all on function gema.get_ginhawa_landing() from public;
grant execute on function gema.get_ginhawa_landing()
  to anon, authenticated, service_role;
