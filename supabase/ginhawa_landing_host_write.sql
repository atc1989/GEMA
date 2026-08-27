-- Allow event hosts (and admins) to manage per-event landing drafts.
-- Public still only reads published rows.
--
-- Apply to STAGING first, then Lifestyle.

drop policy if exists ginhawa_landing_select_published on gema.ginhawa_landing;
create policy ginhawa_landing_select_published
on gema.ginhawa_landing for select
using (
  published = true
  or gema.is_admin()
  or gema.can_manage_event(source_event_id)
);

drop policy if exists ginhawa_landing_admin_write on gema.ginhawa_landing;
drop policy if exists ginhawa_landing_manager_write on gema.ginhawa_landing;

create policy ginhawa_landing_manager_write
on gema.ginhawa_landing for all
using (
  gema.is_admin()
  or gema.can_manage_event(source_event_id)
)
with check (
  gema.is_admin()
  or gema.can_manage_event(source_event_id)
);
