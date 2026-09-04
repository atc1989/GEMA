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

-- 2. Backfill from the Lifestyle columns, for any card rows that exist.
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

-- 3b. Populate the person rows. This is the step that makes the Change true.
--
-- Section G, 2026-09-04: all 15 Auth users came back has_public_profile =
-- false. public.profiles holds no person at all, so step 2 above updates
-- nothing. Without this step the table gains columns and stays empty, and
-- "same id is the person in GEMA and in public.profiles" stays false.
--
-- Two populations, and they are different problems:
--   * 9 users have a gema.profiles row -- copy identity across, same id.
--   * 6 users (created 2026-08-08 to 08-13) have neither, predating whatever
--     began writing gema.profiles on 08-27. All that is known about them is
--     their auth record, so that is what they get. They are people, not cards.
--
-- Idempotent: on conflict do nothing, and re-running adds nobody twice.

-- Guard: refuse rather than half-apply if this table has a NOT NULL column
-- with no default that the inserts below do not supply. `role` is the likely
-- one -- its type and default were never confirmed.
do $$
declare blocking text;
begin
  select string_agg(column_name, ', ' order by column_name) into blocking
    from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles'
     and is_nullable = 'NO' and column_default is null
     and column_name not in ('id', 'full_name', 'email', 'phone',
                             'account_status', 'created_at', 'updated_at');
  if blocking is not null then
    raise exception
      'public.profiles has NOT NULL columns with no default that this backfill does not fill: %. Tell me their intended values and I will supply them.', blocking;
  end if;
end $$;

insert into public.profiles (id, full_name, email, phone, account_status)
select g.id,
       coalesce(nullif(btrim(g.full_name), ''),
                nullif(btrim(concat_ws(' ', g.first_name, g.last_name)), ''),
                split_part(coalesce(g.email::text, ''), '@', 1)),
       g.email::text,
       g.phone,
       'active'
  from gema.profiles g
 where not exists (select 1 from public.profiles p where p.id = g.id)
on conflict (id) do nothing;

insert into public.profiles (id, full_name, email, account_status)
select u.id,
       coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''),
                nullif(u.raw_user_meta_data ->> 'name', ''),
                nullif(u.raw_user_meta_data ->> 'username', ''),
                nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
                'member'),
       u.email,
       'active'
  from auth.users u
 where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- 3c. The other side of the spine. GEMA reads gema.profiles, not
--     public.profiles -- every client in src/lib/supabase pins schema "gema".
--
-- Filling public.profiles alone left a signed-in member with no GEMA person
-- row, and GEMA's landing loops on that: redirectAfterLogin finds no profile
-- and no member so it sends them to /onboarding, and /onboarding finds no
-- profile so it sends them back to /login. A valid session, and the login page
-- forever.
--
-- 00 - Locks: one auth.users.id is one person row. A person row is exactly
-- what this creates -- no gema.members row, no Lifestyle card, no Academy BASE.
insert into gema.profiles (id, email, full_name)
select p.id,
       p.email,
       coalesce(nullif(btrim(p.full_name), ''),
                nullif(split_part(coalesce(p.email, ''), '@', 1), ''),
                'member')
  from public.profiles p
 where not exists (select 1 from gema.profiles g where g.id = p.id)
on conflict (id) do nothing;

-- full_name is NOT NULL but an empty string passes that, and at least one row
-- carries its name only in first_name/last_name. A person with a blank name
-- renders as nobody, so fill it from the parts, then the address.
update gema.profiles
   set full_name = coalesce(
         nullif(btrim(concat_ws(' ', first_name, last_name)), ''),
         nullif(split_part(coalesce(email::text, ''), '@', 1), ''),
         'member')
 where coalesce(btrim(full_name), '') = '';

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

-- 5. Members must not write their own role or account status.
--
-- profiles_update_own (Lifestyle 20260822000000) grants UPDATE on the whole
-- row. RLS cannot express column limits; column GRANTs can, and do not depend
-- on a policy's with-check staying correct as policies get redefined.
--
-- WHAT IS AND IS NOT PROTECTED HERE, and why the line is where it is:
--
-- `role` is an authorization column. 03 - Identity model: members must not
-- write their own roles, on any column. It is revoked, and that is the whole
-- point of this step.
--
-- `points`, `phase`, `claimed`, `banked`, `pending`, `days_left`, `card_no`
-- are NOT revoked, and an earlier draft of this file revoked them. That was
-- wrong and it broke Lifestyle: lib/actions/member.ts claimCard() and the
-- profile patch, and the register upsert in lib/actions/auth.ts, all write
-- those columns with the MEMBER'S OWN session client. That is Lifestyle's
-- design -- a self-service card app whose client advances its own progress --
-- not an oversight to close from underneath it.
--
-- So yes: a member can still inflate their own points. That is a product
-- question about the card, not an auth bypass, it predates this Change, and
-- Change 4 is where it belongs -- once card/points live in their own table
-- with their own policy, they can be governed without breaking the app.
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
  updated_at,
  -- Lifestyle's own card flow, written by the member's session client:
  card_no,
  phase,
  claimed,
  points,
  pending,
  banked,
  days_left
) on public.profiles to authenticated;

-- Deliberately not granted: role, account_status, sponsor, team, id,
-- created_at. Nothing in Lifestyle writes those from a member session.

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
