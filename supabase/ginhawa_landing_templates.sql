-- Expand landing templates beyond medical.
-- Apply to STAGING first, then Lifestyle.

alter table gema.ginhawa_landing
  drop constraint if exists ginhawa_landing_template_check;

alter table gema.ginhawa_landing
  add constraint ginhawa_landing_template_check
  check (template in ('medical', 'sizzle', 'session'));

-- Legacy singleton reader: latest published landing of any template.
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
  order by
    case when template = 'medical' then 0 else 1 end,
    published_at desc nulls last,
    updated_at desc
  limit 1;

  if not found then
    return null;
  end if;

  return gema.ginhawa_landing_payload(v_row);
end;
$$;
