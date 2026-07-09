-- GutGuard Daily module for the existing GEMA Supabase project.
-- Run once in the Supabase SQL editor after the GEMA base schema exists.
-- Identity intentionally uses public.profiles(id), which is auth.users(id).

begin;

create extension if not exists pgcrypto;

do $$ begin create type public.gutguard_dose_slot as enum ('morning', 'midday', 'dreams'); exception when duplicate_object then null; end $$;
do $$ begin create type public.gutguard_dose_status as enum ('scheduled', 'taken', 'skipped', 'missed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.gutguard_reminder_channel as enum ('in_app', 'push', 'sms', 'messenger', 'viber', 'call'); exception when duplicate_object then null; end $$;
do $$ begin create type public.gutguard_journey_message_status as enum ('pending', 'sent', 'failed', 'dismissed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.gutguard_relationship_status as enum ('pending', 'active', 'revoked'); exception when duplicate_object then null; end $$;
do $$ begin create type public.gutguard_team_member_role as enum ('member', 'caregiver', 'team_lead'); exception when duplicate_object then null; end $$;

create table if not exists public.gutguard_care_relationships (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  caregiver_id uuid not null references public.profiles(id) on delete cascade,
  status public.gutguard_relationship_status not null default 'pending',
  can_view_doses boolean not null default true,
  can_record_doses boolean not null default false,
  can_manage_reminders boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, caregiver_id),
  check (patient_id <> caregiver_id)
);

create table if not exists public.gutguard_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lead_id uuid not null references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gutguard_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.gutguard_teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  member_role public.gutguard_team_member_role not null default 'member',
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (team_id, profile_id)
);

create table if not exists public.gutguard_daily_doses (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  dose_date date not null,
  slot public.gutguard_dose_slot not null,
  capsules smallint not null default 1 check (capsules between 0 and 3),
  status public.gutguard_dose_status not null default 'scheduled',
  taken_at timestamptz,
  proof_path text,
  recorded_by uuid not null references public.profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, dose_date, slot),
  check ((status = 'taken' and taken_at is not null) or status <> 'taken')
);

create table if not exists public.gutguard_reminders (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  slot public.gutguard_dose_slot,
  channel public.gutguard_reminder_channel not null default 'in_app',
  local_time time not null,
  timezone text not null default 'Asia/Manila',
  days_of_week smallint[] not null default array[0,1,2,3,4,5,6]::smallint[],
  locale text not null default 'en' check (locale in ('en', 'tl', 'bis')),
  enabled boolean not null default true,
  next_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (days_of_week <@ array[0,1,2,3,4,5,6]::smallint[])
);

create table if not exists public.gutguard_journey_messages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id),
  protocol_day smallint check (protocol_day between 0 and 365),
  message_type text not null,
  channel public.gutguard_reminder_channel not null,
  body text not null,
  scheduled_for timestamptz,
  sent_at timestamptz,
  status public.gutguard_journey_message_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gutguard_onboarding_progress (
  patient_id uuid primary key references public.profiles(id) on delete cascade,
  current_step text not null default 'profile',
  completed_steps text[] not null default '{}'::text[],
  tier smallint check (tier between 1 and 4),
  default_channel public.gutguard_reminder_channel,
  helper_profile_id uuid references public.profiles(id) on delete set null,
  consent_caregiver_at timestamptz,
  consent_leader_proof_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gutguard_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

create index if not exists gutguard_daily_doses_patient_date_idx on public.gutguard_daily_doses (patient_id, dose_date desc);
create index if not exists gutguard_reminders_patient_enabled_idx on public.gutguard_reminders (patient_id, enabled);
create index if not exists gutguard_journey_messages_assignee_schedule_idx on public.gutguard_journey_messages (assigned_to, scheduled_for);
create index if not exists gutguard_journey_messages_patient_idx on public.gutguard_journey_messages (patient_id, created_at desc);
create index if not exists gutguard_team_members_profile_idx on public.gutguard_team_members (profile_id) where left_at is null;
create index if not exists gutguard_care_relationships_caregiver_idx on public.gutguard_care_relationships (caregiver_id) where status = 'active';
create index if not exists gutguard_audit_logs_record_idx on public.gutguard_audit_logs (table_name, record_id, created_at desc);

create or replace function public.gutguard_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.gutguard_write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_record_id text;
begin
  changed_record_id := coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id'), (to_jsonb(new) ->> 'patient_id'), (to_jsonb(old) ->> 'patient_id'));

  insert into public.gutguard_audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    changed_record_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'gutguard_care_relationships',
    'gutguard_teams',
    'gutguard_daily_doses',
    'gutguard_reminders',
    'gutguard_journey_messages',
    'gutguard_onboarding_progress'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', target_table || '_set_updated_at', target_table);
    execute format('create trigger %I before update on public.%I for each row execute function public.gutguard_set_updated_at()', target_table || '_set_updated_at', target_table);
  end loop;

  foreach target_table in array array[
    'gutguard_care_relationships',
    'gutguard_teams',
    'gutguard_team_members',
    'gutguard_daily_doses',
    'gutguard_reminders',
    'gutguard_journey_messages',
    'gutguard_onboarding_progress'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', target_table || '_audit', target_table);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.gutguard_write_audit_log()', target_table || '_audit', target_table);
  end loop;
end $$;

create or replace function public.gutguard_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = (select auth.uid())), false);
$$;

create or replace function public.gutguard_can_lead_team()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.is_admin or p.can_publish_events from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

create or replace function public.gutguard_can_access_patient(target_patient_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    (select auth.uid()) = target_patient_id
    or public.gutguard_is_admin()
    or exists (
      select 1 from public.gutguard_care_relationships cr
      where cr.patient_id = target_patient_id
        and cr.caregiver_id = (select auth.uid())
        and cr.status = 'active'
        and cr.can_view_doses
    )
    or exists (
      select 1
      from public.gutguard_team_members tm
      join public.gutguard_teams t on t.id = tm.team_id
      where tm.profile_id = target_patient_id
        and tm.left_at is null
        and t.lead_id = (select auth.uid())
    );
$$;

create or replace function public.gutguard_can_record_patient_dose(target_patient_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    (select auth.uid()) = target_patient_id
    or public.gutguard_is_admin()
    or exists (
      select 1 from public.gutguard_care_relationships cr
      where cr.patient_id = target_patient_id
        and cr.caregiver_id = (select auth.uid())
        and cr.status = 'active'
        and cr.can_record_doses
    );
$$;

create or replace function public.gutguard_can_manage_patient_reminders(target_patient_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    (select auth.uid()) = target_patient_id
    or public.gutguard_is_admin()
    or exists (
      select 1 from public.gutguard_care_relationships cr
      where cr.patient_id = target_patient_id
        and cr.caregiver_id = (select auth.uid())
        and cr.status = 'active'
        and cr.can_manage_reminders
    );
$$;

create or replace function public.gutguard_can_manage_team(target_team_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.gutguard_is_admin() or exists (
    select 1 from public.gutguard_teams t
    where t.id = target_team_id and t.lead_id = (select auth.uid())
  );
$$;

grant execute on function public.gutguard_is_admin() to authenticated;
grant execute on function public.gutguard_can_lead_team() to authenticated;
grant execute on function public.gutguard_can_access_patient(uuid) to authenticated;
grant execute on function public.gutguard_can_record_patient_dose(uuid) to authenticated;
grant execute on function public.gutguard_can_manage_patient_reminders(uuid) to authenticated;
grant execute on function public.gutguard_can_manage_team(uuid) to authenticated;

alter table public.gutguard_care_relationships enable row level security;
alter table public.gutguard_teams enable row level security;
alter table public.gutguard_team_members enable row level security;
alter table public.gutguard_daily_doses enable row level security;
alter table public.gutguard_reminders enable row level security;
alter table public.gutguard_journey_messages enable row level security;
alter table public.gutguard_onboarding_progress enable row level security;
alter table public.gutguard_audit_logs enable row level security;

drop policy if exists gutguard_care_relationships_select on public.gutguard_care_relationships;
create policy gutguard_care_relationships_select on public.gutguard_care_relationships for select to authenticated
using (patient_id = (select auth.uid()) or caregiver_id = (select auth.uid()) or public.gutguard_is_admin());
drop policy if exists gutguard_care_relationships_patient_insert on public.gutguard_care_relationships;
create policy gutguard_care_relationships_patient_insert on public.gutguard_care_relationships for insert to authenticated
with check (patient_id = (select auth.uid()) and created_by = (select auth.uid()));
drop policy if exists gutguard_care_relationships_patient_update on public.gutguard_care_relationships;
create policy gutguard_care_relationships_patient_update on public.gutguard_care_relationships for update to authenticated
using (patient_id = (select auth.uid()) or caregiver_id = (select auth.uid()))
with check (patient_id = (select auth.uid()) or caregiver_id = (select auth.uid()));
drop policy if exists gutguard_care_relationships_admin_all on public.gutguard_care_relationships;
create policy gutguard_care_relationships_admin_all on public.gutguard_care_relationships for all to authenticated
using (public.gutguard_is_admin()) with check (public.gutguard_is_admin());

drop policy if exists gutguard_teams_select on public.gutguard_teams;
create policy gutguard_teams_select on public.gutguard_teams for select to authenticated
using (
  lead_id = (select auth.uid()) or public.gutguard_is_admin()
  or exists (
    select 1 from public.gutguard_team_members tm
    where tm.team_id = id and tm.profile_id = (select auth.uid()) and tm.left_at is null
  )
);
drop policy if exists gutguard_teams_lead_insert on public.gutguard_teams;
create policy gutguard_teams_lead_insert on public.gutguard_teams for insert to authenticated
with check (lead_id = (select auth.uid()) and created_by = (select auth.uid()) and public.gutguard_can_lead_team());
drop policy if exists gutguard_teams_lead_update on public.gutguard_teams;
create policy gutguard_teams_lead_update on public.gutguard_teams for update to authenticated
using (lead_id = (select auth.uid()) or public.gutguard_is_admin())
with check (lead_id = (select auth.uid()) or public.gutguard_is_admin());
drop policy if exists gutguard_teams_admin_delete on public.gutguard_teams;
create policy gutguard_teams_admin_delete on public.gutguard_teams for delete to authenticated using (public.gutguard_is_admin());

drop policy if exists gutguard_team_members_select on public.gutguard_team_members;
create policy gutguard_team_members_select on public.gutguard_team_members for select to authenticated
using (profile_id = (select auth.uid()) or public.gutguard_can_manage_team(team_id));
drop policy if exists gutguard_team_members_manage on public.gutguard_team_members;
create policy gutguard_team_members_manage on public.gutguard_team_members for all to authenticated
using (public.gutguard_can_manage_team(team_id)) with check (public.gutguard_can_manage_team(team_id));

drop policy if exists gutguard_daily_doses_select on public.gutguard_daily_doses;
create policy gutguard_daily_doses_select on public.gutguard_daily_doses for select to authenticated
using (public.gutguard_can_access_patient(patient_id));
drop policy if exists gutguard_daily_doses_insert on public.gutguard_daily_doses;
create policy gutguard_daily_doses_insert on public.gutguard_daily_doses for insert to authenticated
with check (public.gutguard_can_record_patient_dose(patient_id) and recorded_by = (select auth.uid()));
drop policy if exists gutguard_daily_doses_update on public.gutguard_daily_doses;
create policy gutguard_daily_doses_update on public.gutguard_daily_doses for update to authenticated
using (public.gutguard_can_record_patient_dose(patient_id))
with check (public.gutguard_can_record_patient_dose(patient_id));
drop policy if exists gutguard_daily_doses_delete on public.gutguard_daily_doses;
create policy gutguard_daily_doses_delete on public.gutguard_daily_doses for delete to authenticated
using (patient_id = (select auth.uid()) or public.gutguard_is_admin());

drop policy if exists gutguard_reminders_select on public.gutguard_reminders;
create policy gutguard_reminders_select on public.gutguard_reminders for select to authenticated
using (public.gutguard_can_access_patient(patient_id));
drop policy if exists gutguard_reminders_insert on public.gutguard_reminders;
create policy gutguard_reminders_insert on public.gutguard_reminders for insert to authenticated
with check (public.gutguard_can_manage_patient_reminders(patient_id) and created_by = (select auth.uid()));
drop policy if exists gutguard_reminders_update on public.gutguard_reminders;
create policy gutguard_reminders_update on public.gutguard_reminders for update to authenticated
using (public.gutguard_can_manage_patient_reminders(patient_id))
with check (public.gutguard_can_manage_patient_reminders(patient_id));
drop policy if exists gutguard_reminders_delete on public.gutguard_reminders;
create policy gutguard_reminders_delete on public.gutguard_reminders for delete to authenticated
using (public.gutguard_can_manage_patient_reminders(patient_id));

drop policy if exists gutguard_journey_messages_select on public.gutguard_journey_messages;
create policy gutguard_journey_messages_select on public.gutguard_journey_messages for select to authenticated
using (patient_id = (select auth.uid()) or assigned_to = (select auth.uid()) or public.gutguard_can_access_patient(patient_id));
drop policy if exists gutguard_journey_messages_insert on public.gutguard_journey_messages;
create policy gutguard_journey_messages_insert on public.gutguard_journey_messages for insert to authenticated
with check (created_by = (select auth.uid()) and (public.gutguard_is_admin() or public.gutguard_can_access_patient(patient_id)));
drop policy if exists gutguard_journey_messages_update on public.gutguard_journey_messages;
create policy gutguard_journey_messages_update on public.gutguard_journey_messages for update to authenticated
using (assigned_to = (select auth.uid()) or patient_id = (select auth.uid()) or public.gutguard_is_admin())
with check (assigned_to = (select auth.uid()) or patient_id = (select auth.uid()) or public.gutguard_is_admin());
drop policy if exists gutguard_journey_messages_delete on public.gutguard_journey_messages;
create policy gutguard_journey_messages_delete on public.gutguard_journey_messages for delete to authenticated
using (public.gutguard_is_admin());

drop policy if exists gutguard_onboarding_select on public.gutguard_onboarding_progress;
create policy gutguard_onboarding_select on public.gutguard_onboarding_progress for select to authenticated
using (public.gutguard_can_access_patient(patient_id));
drop policy if exists gutguard_onboarding_insert on public.gutguard_onboarding_progress;
create policy gutguard_onboarding_insert on public.gutguard_onboarding_progress for insert to authenticated
with check (patient_id = (select auth.uid()) or public.gutguard_is_admin());
drop policy if exists gutguard_onboarding_update on public.gutguard_onboarding_progress;
create policy gutguard_onboarding_update on public.gutguard_onboarding_progress for update to authenticated
using (patient_id = (select auth.uid()) or public.gutguard_is_admin())
with check (patient_id = (select auth.uid()) or public.gutguard_is_admin());

drop policy if exists gutguard_audit_logs_admin_select on public.gutguard_audit_logs;
create policy gutguard_audit_logs_admin_select on public.gutguard_audit_logs for select to authenticated
using (public.gutguard_is_admin());

commit;
