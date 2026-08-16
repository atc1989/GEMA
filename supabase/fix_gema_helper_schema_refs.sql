-- Finish leftover public.* helper calls after tables/RPCs moved to gema.
-- Applied on GutGuard LifeStyle (rvwseybgimmewuoccecu). Safe to re-run.
-- Enums such as public.registration_source remain in public on purpose.
--
-- Do not use this to move tables; it only rewrites function bodies.

create or replace function gema.can_manage_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'gema', 'public'
as $$
  select gema.is_admin()
    or exists (
      select 1
      from gema.events e
      left join gema.members m on m.id = e.host_member_id
      where e.id = target_event_id
        and (e.created_by_profile_id = auth.uid() or m.profile_id = auth.uid())
    )
$$;

create or replace function gema.can_write_event_row(
  target_created_by_profile_id uuid,
  target_host_member_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'gema', 'public'
as $$
  select auth.uid() is not null
    and (
      gema.is_admin()
      or target_created_by_profile_id = auth.uid()
      or exists (
        select 1
        from gema.members m
        where m.id = target_host_member_id
          and m.profile_id = auth.uid()
      )
    )
$$;

-- Other gema functions were updated the same way (public.X → gema.X):
--   get_event_attendee_sponsors      public.can_manage_event → gema.can_manage_event
--   get_member_event_cards           public.current_member_id → gema.current_member_id
--   gutguard_can_access_patient      public.gutguard_is_admin → gema.gutguard_is_admin
--   gutguard_can_manage_patient_reminders
--   gutguard_can_record_patient_dose
--   prevent_member_event_permission_self_update  public.is_admin → gema.is_admin
--   update_member_event_publishing_permission
--   record_attendance                public.can_manage_event → gema.can_manage_event
--   onboard_member                   public.link_member_genealogy → gema.link_member_genealogy
--   convert_prospect_to_member       public.link_member_genealogy / generate_conversion_commissions
--                                    → gema.*
