-- =============================================================
-- Fix: creating ANY new auth user fails with a 500, so first-time
-- external (OneGrinders) logins die with
--   "Unable to create the local auth user".
--
-- Cause: triggers on auth.users fire in ALPHABETICAL order. A
-- GutGuard Daily trigger (`gutguard_on_auth_user_created`) used to
-- fire BEFORE on_auth_user_created and insert into
-- gutguard_onboarding_progress before public.profiles existed.
-- GutGuard Daily has been removed; this file now drops those
-- leftover triggers and keeps the handle_new_user full_name fix.
--
-- Run in the Supabase SQL editor. Safe to re-run.
-- =============================================================

-- 1) Drop leftover GutGuard Daily auth triggers if they still exist.
drop trigger if exists gutguard_on_auth_user_created on auth.users;
drop trigger if exists zz_gutguard_on_auth_user_created on auth.users;

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
