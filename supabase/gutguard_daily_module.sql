-- GutGuard Daily module for the existing GEMA Supabase project.
-- Run once in the Supabase SQL editor after the GEMA base schema exists.
-- Identity intentionally uses public.profiles(id), which is auth.users(id).

create extension if not exists pgcrypto;

do $$
begin
  create type public.gutguard_dose_slot as enum ('morning', 'midday', 'dreams');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.gutguard_dose_status as enum ('scheduled', 'taken', 'skipped', 'missed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.gutguard_reminder_channel as enum ('in_app', 'push', 'sms', 'messenger', 'viber', 'call');
exception
  when duplicate_object then null;
end $$;

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

create index if not exists gutguard_daily_doses_patient_date_idx
  on public.gutguard_daily_doses (patient_id, dose_date desc);

create index if not exists gutguard_reminders_patient_enabled_idx
  on public.gutguard_reminders (patient_id, enabled);

create or replace function public.gutguard_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists gutguard_daily_doses_set_updated_at on public.gutguard_daily_doses;
create trigger gutguard_daily_doses_set_updated_at
before update on public.gutguard_daily_doses
for each row execute function public.gutguard_set_updated_at();

drop trigger if exists gutguard_reminders_set_updated_at on public.gutguard_reminders;
create trigger gutguard_reminders_set_updated_at
before update on public.gutguard_reminders
for each row execute function public.gutguard_set_updated_at();

create or replace function public.gutguard_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

create or replace function public.gutguard_can_access_patient(target_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) = target_patient_id or public.gutguard_is_admin();
$$;

create or replace function public.gutguard_can_record_patient_dose(target_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) = target_patient_id or public.gutguard_is_admin();
$$;

create or replace function public.gutguard_can_manage_patient_reminders(target_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) = target_patient_id or public.gutguard_is_admin();
$$;

grant execute on function public.gutguard_is_admin() to authenticated;
grant execute on function public.gutguard_can_access_patient(uuid) to authenticated;
grant execute on function public.gutguard_can_record_patient_dose(uuid) to authenticated;
grant execute on function public.gutguard_can_manage_patient_reminders(uuid) to authenticated;

alter table public.gutguard_daily_doses enable row level security;
alter table public.gutguard_reminders enable row level security;

drop policy if exists gutguard_daily_doses_select on public.gutguard_daily_doses;
create policy gutguard_daily_doses_select
on public.gutguard_daily_doses for select to authenticated
using (public.gutguard_can_access_patient(patient_id));

drop policy if exists gutguard_daily_doses_insert on public.gutguard_daily_doses;
create policy gutguard_daily_doses_insert
on public.gutguard_daily_doses for insert to authenticated
with check (
  public.gutguard_can_record_patient_dose(patient_id)
  and recorded_by = (select auth.uid())
);

drop policy if exists gutguard_daily_doses_update on public.gutguard_daily_doses;
create policy gutguard_daily_doses_update
on public.gutguard_daily_doses for update to authenticated
using (public.gutguard_can_record_patient_dose(patient_id))
with check (public.gutguard_can_record_patient_dose(patient_id));

drop policy if exists gutguard_daily_doses_delete on public.gutguard_daily_doses;
create policy gutguard_daily_doses_delete
on public.gutguard_daily_doses for delete to authenticated
using (patient_id = (select auth.uid()) or public.gutguard_is_admin());

drop policy if exists gutguard_reminders_select on public.gutguard_reminders;
create policy gutguard_reminders_select
on public.gutguard_reminders for select to authenticated
using (public.gutguard_can_access_patient(patient_id));

drop policy if exists gutguard_reminders_insert on public.gutguard_reminders;
create policy gutguard_reminders_insert
on public.gutguard_reminders for insert to authenticated
with check (
  public.gutguard_can_manage_patient_reminders(patient_id)
  and created_by = (select auth.uid())
);

drop policy if exists gutguard_reminders_update on public.gutguard_reminders;
create policy gutguard_reminders_update
on public.gutguard_reminders for update to authenticated
using (public.gutguard_can_manage_patient_reminders(patient_id))
with check (public.gutguard_can_manage_patient_reminders(patient_id));

drop policy if exists gutguard_reminders_delete on public.gutguard_reminders;
create policy gutguard_reminders_delete
on public.gutguard_reminders for delete to authenticated
using (public.gutguard_can_manage_patient_reminders(patient_id));
