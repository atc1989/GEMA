-- =============================================================
-- Drop GutGuard Daily from an existing GEMA Supabase project.
-- Run once in the Supabase SQL editor. Idempotent.
--
-- Removes dose tracking, reminders, journey, community, dosing
-- config, audit logs, helper functions/types, and the auth.users
-- trigger that inserted gutguard_onboarding_progress.
--
-- Objects may live in public (original SQL files) or gema (the
-- schema the Next.js client uses). Both are dropped if present.
--
-- Keeps GEMA E-Points (events / team_recognition). Historical
-- daily_* ledger rows are deleted so the param check can shrink.
-- =============================================================

begin;

drop trigger if exists gutguard_on_auth_user_created on auth.users;
drop trigger if exists zz_gutguard_on_auth_user_created on auth.users;

do $$
declare
  sch text;
  tbl text;
  fn record;
  typ text;
begin
  foreach sch in array array['public', 'gema']
  loop
    if not exists (select 1 from pg_namespace where nspname = sch) then
      continue;
    end if;

    foreach tbl in array array[
      'gutguard_dosing_config',
      'gutguard_team_members',
      'gutguard_daily_doses',
      'gutguard_reminders',
      'gutguard_journey_messages',
      'gutguard_onboarding_progress',
      'gutguard_care_relationships',
      'gutguard_audit_logs',
      'gutguard_teams'
    ]
    loop
      execute format('drop table if exists %I.%I cascade', sch, tbl);
    end loop;

    for fn in
      select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = sch
        and p.proname in (
          'gutguard_handle_new_user',
          'gutguard_can_manage_team',
          'gutguard_can_manage_patient_reminders',
          'gutguard_can_record_patient_dose',
          'gutguard_can_access_patient',
          'gutguard_can_lead_team',
          'gutguard_is_admin',
          'gutguard_write_audit_log',
          'gutguard_set_updated_at'
        )
    loop
      execute format('drop function if exists %s cascade', fn.sig);
    end loop;

    foreach typ in array array[
      'gutguard_team_member_role',
      'gutguard_relationship_status',
      'gutguard_journey_message_status',
      'gutguard_reminder_channel',
      'gutguard_dose_status',
      'gutguard_dose_slot'
    ]
    loop
      execute format('drop type if exists %I.%I cascade', sch, typ);
    end loop;

    if exists (
      select 1
      from information_schema.tables
      where table_schema = sch and table_name = 'epoint_entries'
    ) then
      execute format(
        'delete from %I.epoint_entries where param in (''daily_dose'', ''daily_checkin'', ''my_journey'')',
        sch
      );
      execute format(
        'alter table %I.epoint_entries drop constraint if exists epoint_entries_param_check',
        sch
      );
      execute format(
        'alter table %I.epoint_entries add constraint epoint_entries_param_check check (param in (''events'', ''team_recognition''))',
        sch
      );
    end if;
  end loop;
end $$;

commit;
