-- Change 3 preflight. READ ONLY — run this on Staging before applying
-- migrations/20260904000000_shared_person_profiles.sql and send back the output.
--
-- Run this before applying change3_shared_person_profiles.sql, and send back
-- the output. Section 1 already came back on 2026-09-04 and disproved the
-- premise an earlier pass was built on: public.profiles on Staging is the
-- person table GEMA extended, NOT the Lifestyle card table. Sections 2, 3, 9
-- and 10 are still outstanding.

-- 1. The real shape of public.profiles.
select ordinal_position, column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'profiles'
 order by ordinal_position;

-- 2. Every policy on it today.
select policyname, cmd, roles::text, qual, with_check
  from pg_policies
 where schemaname = 'public' and tablename = 'profiles'
 order by policyname;

-- 3. Column-level grants already in place (expect none before the migration).
select grantee, privilege_type, column_name
  from information_schema.column_privileges
 where table_schema = 'public' and table_name = 'profiles'
   and grantee in ('authenticated', 'anon')
 order by grantee, column_name;

-- 4. Objects the migration depends on.
select
  to_regprocedure('public.is_admin()') is not null as has_is_admin,
  to_regclass('gema.profiles')         is not null as has_gema_profiles,
  to_regclass('gema.members')          is not null as has_gema_members;

-- 5. How much data is at stake.
select
  (select count(*) from auth.users)      as auth_users,
  (select count(*) from public.profiles) as public_profiles;

-- 5b. WHO IS ALREADY AN ADMIN. Read this one carefully.
--
-- profiles_update_own is `with check (id = auth.uid() and is_admin = false)`.
-- It pins is_admin and says nothing about role, and public.is_admin() is
-- `is_admin = true OR role = 'admin'`. So until the migration's column GRANTs
-- land, one PATCH — update profiles set role = 'admin' where id = auth.uid() —
-- makes any member an admin. The migration closes that door; it cannot tell
-- you whether anyone already walked through it. Only you know which of these
-- rows is supposed to be here.
select id, email, full_name, role, is_admin, can_publish_events, created_at
  from public.profiles
 where is_admin = true or role = 'admin' or can_publish_events = true
 order by created_at;

-- 6. The six Auth users with no person row — the reconcile problem.
select u.id, u.email, u.created_at,
       (u.raw_user_meta_data->>'provider') as provider,
       (u.raw_user_meta_data->>'username') as username
  from auth.users u
  left join public.profiles p on p.id = u.id
 where p.id is null
 order by u.created_at;

-- 7. Same question against the GEMA spine.
select u.id, u.email
  from auth.users u
  left join gema.profiles g on g.id = u.id
 where g.id is null
 order by u.created_at;

-- 8. Triggers on auth.users — which app's handle_new_user is actually armed.
select t.tgname, n.nspname || '.' || p.proname as function
  from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
  join pg_namespace n on n.oid = p.pronamespace
 where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal
 order by t.tgname;

-- 9. The body of every trigger function armed on auth.users, plus any function
--    named handle_new_user in any schema.
--
--    This matters more than it looks. GEMA's supabase/fix_auth_user_triggers.sql
--    defines public.handle_new_user() inserting first_name/last_name/full_name
--    into public.profiles. The 2026-09-03 Staging report described a
--    handle_new_user that writes gema.profiles instead. Both cannot be the same
--    function. Staging's public.profiles is Lifestyle-shaped and has none of
--    those columns, so if the GEMA version is what is armed there, creating an
--    Auth user on Staging should be failing outright — and it is not, because
--    15 users exist. Read the body rather than guess which one it is.
select n.nspname as schema, p.proname as name, pg_get_functiondef(p.oid) as body
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where p.proname like '%handle_new_user%'
    or p.oid in (
      select tgfoid from pg_trigger
       where tgrelid = 'auth.users'::regclass and not tgisinternal
    )
 order by n.nspname, p.proname;

-- 10. Does gema.profiles exist on Staging at all, and what shape.
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'gema' and table_name = 'profiles'
 order by ordinal_position;
