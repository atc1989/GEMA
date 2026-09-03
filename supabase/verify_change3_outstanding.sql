-- Change 3 — the five answers still needed before anything is applied.
-- READ ONLY. Safe on Staging and on production alike; nothing here writes.
-- Run on STAGING (fxdsnacuonfvutdquogb) and send the output back.

-- A. The policies actually on public.profiles. The escalation is proven against
--    this repo's schema files; this is what proves it on the real database.
--    Look at the with_check on profiles_update_own: if it mentions is_admin and
--    not role, the hole is live here.
select policyname, cmd, roles::text, qual, with_check
  from pg_policies
 where schemaname = 'public' and tablename = 'profiles'
 order by policyname;

-- B. Column-level grants already in place. Expect none before the migration.
select grantee, privilege_type, column_name
  from information_schema.column_privileges
 where table_schema = 'public' and table_name = 'profiles'
   and grantee in ('authenticated', 'anon')
   and privilege_type = 'UPDATE'
 order by grantee, column_name;

-- C. Who is already an admin. The migration closes the door; it cannot say who
--    already walked through it. Only you know which of these rows belong.
select id, email, full_name, role, is_admin, can_publish_events, created_at
  from public.profiles
 where is_admin = true or role = 'admin' or can_publish_events = true
 order by created_at;

-- D. What a new Auth user actually writes today.
select n.nspname as schema, p.proname as name, pg_get_functiondef(p.oid) as body
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where p.oid in (select tgfoid from pg_trigger
                  where tgrelid = 'auth.users'::regclass and not tgisinternal);

-- E. Does gema.profiles exist, and in what shape. The GEMA app reads this, not
--    public.profiles — every client in src/lib/supabase pins schema "gema".
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'gema' and table_name = 'profiles'
 order by ordinal_position;
