-- Change 3 — the answers still needed before anything is applied.
-- READ ONLY. Nothing here writes, on any project.
--
-- Run section 0 FIRST and send it before the rest. On 2026-09-04 a run of
-- section C failed with `column "full_name" does not exist` on a project whose
-- public.profiles had been reported as having it, which means two different
-- databases are in play. Section 0 says which one you are on and what is
-- really in it, so the later sections can be trusted.

-- 0. Where am I, and what does every table named "profiles" look like here?
select current_database() as db, current_user as role_name;

select table_schema, table_name,
       string_agg(column_name, ', ' order by ordinal_position) as columns
  from information_schema.columns
 where table_name = 'profiles'
 group by table_schema, table_name
 order by table_schema;

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
--    Written against the columns section 1 reported. If it errors with
--    "column ... does not exist", send section 0 instead and I will rewrite it
--    for the shape that is actually there.
select *
  from public.profiles
 where is_admin = true or role = 'admin'
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
