-- Change 3 — public.profiles as the shared person table.
--
-- Staging only (fxdsnacuonfvutdquogb). Production Auth rvwseybgimmewuoccecu is
-- untouched.
--
-- WHAT IS ACTUALLY IN THIS DATABASE (section 0, 2026-09-04). Two tables named
-- profiles, in two schemas, and confusing them cost this Change two rewrites:
--
--   public.profiles  id, name, mobile, email, sponsor, team, card_no, phase,
--                    claimed, points, pending, banked, days_left,
--                    capsules_per_day, telegram, facebook, notifications,
--                    welcome_seen, created_at, updated_at, role
--                    -> the Lifestyle card table, plus a `role` column that no
--                       Lifestyle migration in that repo creates.
--
--   gema.profiles    id, email, first_name, last_name, full_name, created_at,
--                    updated_at, phone, role, is_admin, avatar_url,
--                    last_seen_at, can_publish_events
--                    -> GEMA's person table. What the GEMA app reads; every
--                       client in GEMA/src/lib/supabase pins schema "gema".
--
-- This file changes public.profiles ONLY. It does not touch gema.profiles.
--
-- EXPAND ONLY. Nothing renamed, nothing dropped. Lifestyle keeps writing
-- name/mobile and keeps working. Change 4 does the contract half — moving
-- card/points out and dropping the duplicates left here.

begin;

-- 1. Identity columns. The person, not the card.
alter table public.profiles
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists avatar_url text,
  add column if not exists locale text,
  add column if not exists timezone text,
  add column if not exists account_status text not null default 'active',
  add column if not exists last_seen_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_account_status_check;
alter table public.profiles
  add constraint profiles_account_status_check
  check (account_status in ('active', 'suspended', 'closed'));

-- 2. Backfill from the columns that already hold this data.
update public.profiles
   set full_name = coalesce(full_name, nullif(btrim(name), '')),
       phone     = coalesce(phone, nullif(btrim(mobile), ''))
 where full_name is null
    or phone is null;

-- 3. A person can now exist without a Lifestyle card.
--
-- 00 - Locks: "New Auth user creates a person only. Never auto-enrol Academy
-- BASE or a Lifestyle card." That is impossible to honour while name, mobile
-- and card_no are NOT NULL with no default — any insert mints a card. Existing
-- rows keep their values.
alter table public.profiles alter column name    drop not null;
alter table public.profiles alter column mobile  drop not null;
alter table public.profiles alter column card_no drop not null;
alter table public.profiles alter column sponsor drop not null;
alter table public.profiles alter column team    drop not null;

-- 4. Keep the old and new spellings in step until Change 4 removes the old
--    ones. Lifestyle writes name/mobile; anything person-shaped writes
--    full_name/phone. Either side filling one fills the other.
create or replace function public.sync_profile_identity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    new.full_name := coalesce(nullif(btrim(new.full_name), ''), nullif(btrim(new.name), ''));
    new.name      := coalesce(nullif(btrim(new.name), ''), nullif(btrim(new.full_name), ''));
    new.phone     := coalesce(nullif(btrim(new.phone), ''), nullif(btrim(new.mobile), ''));
    new.mobile    := coalesce(nullif(btrim(new.mobile), ''), nullif(btrim(new.phone), ''));
    return new;
  end if;

  if new.full_name is distinct from old.full_name then
    new.name := new.full_name;
  elsif new.name is distinct from old.name then
    new.full_name := new.name;
  end if;

  if new.phone is distinct from old.phone then
    new.mobile := new.phone;
  elsif new.mobile is distinct from old.mobile then
    new.phone := new.mobile;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_sync_identity on public.profiles;
create trigger profiles_sync_identity
  before insert or update on public.profiles
  for each row execute function public.sync_profile_identity();

-- 5. Members must not write their own role, status, or points.
--
-- profiles_update_own (Lifestyle 20260822000000) grants UPDATE on the whole
-- row, so a member can PATCH points, banked, phase, claimed — and `role`, a
-- column no Lifestyle migration creates and whose purpose is still unconfirmed.
-- 03 - Identity model: members must not write their own roles, on any column.
-- RLS cannot express column limits; column GRANTs can, and do not depend on a
-- policy's with-check staying correct as policies get redefined.
revoke update on public.profiles from authenticated, anon;
grant update (
  full_name,
  name,
  phone,
  mobile,
  email,
  avatar_url,
  locale,
  timezone,
  telegram,
  facebook,
  notifications,
  welcome_seen,
  capsules_per_day,
  updated_at
) on public.profiles to authenticated;

-- Deliberately not granted: role, account_status, card_no, sponsor, team,
-- phase, claimed, points, pending, banked, days_left, id, created_at.

-- 6. account_status has no writer here, and that is deliberate.
--
-- An earlier draft put it behind a definer function gated on
-- public.lifestyle_is_admin(). That function and public.app_roles come from
-- Lifestyle's 20260902000000_lifestyle_admin_rbac.sql, which is NOT applied to
-- this database — the card table is here, the RBAC is not. Rather than create
-- an admin surface this database has never had, or import a migration whose
-- scope belongs to its own Change, account_status simply is not granted to
-- anyone.
--
-- The service role bypasses RLS and column grants, so status changes go through
-- the admin client or the SQL editor, which is already how this schema does
-- admin writes (see the note in 20260902010000_lifestyle_orders_stories.sql:
-- "Inserts come from service role / Route Handler with admin client").
--
-- When Lifestyle's admin RBAC does land here, a definer function gated on
-- lifestyle_is_admin() is the right way to open it up. Not before.

commit;
