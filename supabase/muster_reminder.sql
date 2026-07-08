-- =============================================================
-- Muster Reminder + E-Points
-- Run in the Supabase SQL editor. Idempotent.
--
-- daily_musters   : one row per member per day for the efforts that
--                   can't be derived from existing tables (invited,
--                   presentations, BASE activations, debrief, sales).
--                   "New Prospects" stays derived from public.prospects;
--                   "No-Zero-Day" is derived (any effort > 0).
-- epoint_entries  : append-only points ledger across both apps.
--                   Weekly caps are applied at read time in the app,
--                   NOT in the ledger, so the param maxes can change
--                   without touching data.
-- =============================================================

-- ---------- daily muster logs ----------
create table if not exists public.daily_musters (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  muster_date date not null default (now() at time zone 'utc')::date,
  invited integer not null default 0 check (invited >= 0),
  presentations integer not null default 0 check (presentations >= 0),
  base_activations integer not null default 0 check (base_activations >= 0),
  debriefed boolean not null default false,
  sales numeric(12,2) not null default 0 check (sales >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, muster_date)
);

drop trigger if exists daily_musters_set_updated_at on public.daily_musters;
create trigger daily_musters_set_updated_at
before update on public.daily_musters
for each row execute function public.set_updated_at();

alter table public.daily_musters enable row level security;

drop policy if exists daily_musters_select on public.daily_musters;
create policy daily_musters_select on public.daily_musters
for select using (member_id = public.current_member_id() or public.is_admin());

drop policy if exists daily_musters_insert on public.daily_musters;
create policy daily_musters_insert on public.daily_musters
for insert with check (member_id = public.current_member_id() or public.is_admin());

drop policy if exists daily_musters_update on public.daily_musters;
create policy daily_musters_update on public.daily_musters
for update using (member_id = public.current_member_id() or public.is_admin())
with check (member_id = public.current_member_id() or public.is_admin());

-- ---------- e-points ledger ----------
create table if not exists public.epoint_entries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  -- five real-system parameters; daily_* ones will be written by
  -- Gutguard Daily once it exists, GEMA writes 'events' (trigger below)
  -- and later 'team_recognition'.
  param text not null check (
    param in ('daily_dose', 'daily_checkin', 'my_journey', 'events', 'team_recognition')
  ),
  points integer not null check (points > 0),
  -- idempotency key, e.g. 'attendance:<uuid>'; null for manual admin awards
  source text unique,
  awarded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists epoint_entries_member_awarded_idx
  on public.epoint_entries (member_id, awarded_at desc);

alter table public.epoint_entries enable row level security;

drop policy if exists epoint_entries_select on public.epoint_entries;
create policy epoint_entries_select on public.epoint_entries
for select using (member_id = public.current_member_id() or public.is_admin());

-- members never insert their own points; only admins directly,
-- everything else via security-definer triggers.
drop policy if exists epoint_entries_admin_write on public.epoint_entries;
create policy epoint_entries_admin_write on public.epoint_entries
for insert with check (public.is_admin());

-- ---------- auto-award: event check-in -> +20 'events' points ----------
create or replace function public.award_event_epoints()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.member_id is not null and new.status = 'checked_in' then
    insert into public.epoint_entries (member_id, param, points, source)
    values (new.member_id, 'events', 20, 'attendance:' || new.id)
    on conflict (source) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_award_epoints on public.attendance_records;
create trigger attendance_award_epoints
after insert on public.attendance_records
for each row execute function public.award_event_epoints();
