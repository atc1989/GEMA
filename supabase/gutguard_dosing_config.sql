-- GutGuard Daily dosing config: one row per patient capturing the supply
-- (capsules bought, capsules/day, start date) that powers the tracker's
-- day counter, capsules-remaining math, and refill alerts.
-- Run once in the Supabase SQL editor after gutguard_daily_module.sql.

begin;

create table if not exists public.gutguard_dosing_config (
  patient_id uuid primary key references public.profiles(id) on delete cascade,
  product text not null default 'SynBIOTIC+ · Start',
  total_capsules integer not null check (total_capsules > 0),
  capsules_per_day smallint not null check (capsules_per_day between 1 and 9),
  start_date date not null default current_date,
  locale text not null default 'en' check (locale in ('en', 'tl', 'bis')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists gutguard_dosing_config_set_updated_at on public.gutguard_dosing_config;
create trigger gutguard_dosing_config_set_updated_at
  before update on public.gutguard_dosing_config
  for each row execute function public.gutguard_set_updated_at();

drop trigger if exists gutguard_dosing_config_audit on public.gutguard_dosing_config;
create trigger gutguard_dosing_config_audit
  after insert or update or delete on public.gutguard_dosing_config
  for each row execute function public.gutguard_write_audit_log();

alter table public.gutguard_dosing_config enable row level security;

drop policy if exists gutguard_dosing_config_select on public.gutguard_dosing_config;
create policy gutguard_dosing_config_select on public.gutguard_dosing_config for select to authenticated
using (public.gutguard_can_access_patient(patient_id));
drop policy if exists gutguard_dosing_config_insert on public.gutguard_dosing_config;
create policy gutguard_dosing_config_insert on public.gutguard_dosing_config for insert to authenticated
with check (patient_id = (select auth.uid()) or public.gutguard_is_admin());
drop policy if exists gutguard_dosing_config_update on public.gutguard_dosing_config;
create policy gutguard_dosing_config_update on public.gutguard_dosing_config for update to authenticated
using (patient_id = (select auth.uid()) or public.gutguard_is_admin())
with check (patient_id = (select auth.uid()) or public.gutguard_is_admin());

commit;
