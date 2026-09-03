-- Change 3 — public.profiles as the shared person table.
--
-- Staging only (fxdsnacuonfvutdquogb). Nothing here touches production Auth
-- rvwseybgimmewuoccecu.
--
-- WHAT THIS TABLE ACTUALLY IS (confirmed by query, 2026-09-04, not assumed):
-- public.profiles on Staging is the pre-existing person table GEMA extended —
-- id, email, first_name, last_name, full_name, phone, avatar_url, last_seen_at,
-- role, is_admin, can_publish_events. It is NOT the Lifestyle card table; the
-- Lifestyle migrations in this repo were never applied to Staging. It is also
-- not gema.profiles, which is what the GEMA app reads.
--
-- It is already most of the person table Change 3 wants, and the armed trigger
-- on_auth_user_created -> public.handle_new_user already writes it. Three
-- identity columns are missing, and the privileged columns are not locked.

begin;

-- 1. The identity columns 03 - Identity model asks for and this table lacks.
alter table public.profiles
  add column if not exists locale text,
  add column if not exists timezone text,
  add column if not exists account_status text not null default 'active';

alter table public.profiles
  drop constraint if exists profiles_account_status_check;
alter table public.profiles
  add constraint profiles_account_status_check
  check (account_status in ('active', 'suspended', 'closed'));

-- 2. Members must not write their own role. This is the reason this migration
--    exists in the shape it does.
--
--    profiles_update_own is `with check (id = auth.uid() and is_admin = false)`.
--    It pins is_admin. It says nothing about role. And public.is_admin() is
--    `is_admin = true OR role = 'admin'`. So one PATCH —
--        update profiles set role = 'admin' where id = auth.uid()
--    — passes the check and makes the caller an admin. Verified in
--    tests/database/002_profiles_privilege.test.sql against this exact schema.
--
--    RLS cannot express column limits; column GRANTs can. Revoke the whole-row
--    UPDATE and hand back only the columns a person may edit about themselves.
--    The row policy still applies on top — both must pass.
revoke update on public.profiles from authenticated, anon;
grant update (
  first_name,
  last_name,
  full_name,
  phone,
  avatar_url,
  locale,
  timezone,
  updated_at
) on public.profiles to authenticated;

-- role, is_admin, can_publish_events, account_status, id, email, created_at:
-- deliberately not granted. can_publish_events already has a guard trigger
-- (prevent_member_event_permission_self_update); this makes role and is_admin
-- match it, and does not depend on a policy's with-check staying correct.

-- 3. account_status changes go through an admin-only definer function.
create or replace function public.set_account_status(p_user uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_status not in ('active', 'suspended', 'closed') then
    raise exception 'invalid account status: %', p_status using errcode = '22023';
  end if;
  update public.profiles set account_status = p_status where id = p_user;
end;
$$;

revoke all on function public.set_account_status(uuid, text) from public;
grant execute on function public.set_account_status(uuid, text) to authenticated;

commit;
