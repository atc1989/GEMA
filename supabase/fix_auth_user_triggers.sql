-- =============================================================
-- Fix: creating ANY new auth user fails with a 500, so first-time
-- external (OneGrinders) logins die with
--   "Unable to create the local auth user".
--
-- Cause: triggers on auth.users fire in ALPHABETICAL order.
-- gutguard_on_auth_user_created ('g') fired BEFORE on_auth_user_created
-- ('o'), and its insert into gutguard_onboarding_progress has a foreign
-- key to public.profiles(id) — a row that only exists after
-- handle_new_user runs. FK violation 23503 aborted the whole transaction.
--
-- Fix 1: rename the gutguard trigger so it sorts (and fires) after
--        on_auth_user_created.
-- Fix 2: handle_new_user always produces a non-null full_name, so
--        signups without name metadata (external logins) can't trip
--        profiles.full_name NOT NULL.
--
-- Run in the Supabase SQL editor. Safe to re-run.
-- =============================================================

-- 1) Reorder: 'zz_' sorts after 'on_auth_user_created'.
drop trigger if exists gutguard_on_auth_user_created on auth.users;
drop trigger if exists zz_gutguard_on_auth_user_created on auth.users;
create trigger zz_gutguard_on_auth_user_created
  after insert on auth.users
  for each row execute function public.gutguard_handle_new_user();

-- 2) Never insert a null full_name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(trim(concat_ws(' ',
        new.raw_user_meta_data ->> 'first_name',
        new.raw_user_meta_data ->> 'last_name')), ''),
      nullif(new.raw_user_meta_data ->> 'username', ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
