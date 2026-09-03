-- Change 3 — the answers still needed before the migration is applied.
-- READ ONLY. Nothing here writes.
--
-- Section 0 settled the shape on 2026-09-04: ONE database, TWO tables named
-- profiles. public.profiles is the Lifestyle card table plus a `role` column;
-- gema.profiles is GEMA's person table. Every query below is schema-qualified,
-- because not qualifying them is what cost this Change two rewrites.

-- A. Policies on BOTH tables. The migration changes public.profiles only, but
--    an escalation on gema.profiles would matter just as much.
select schemaname, tablename, policyname, cmd, roles::text, qual, with_check
  from pg_policies
 where tablename = 'profiles' and schemaname in ('public', 'gema')
 order by schemaname, policyname;

-- B. Column-level UPDATE grants already in place. Expect none on either.
select table_schema, grantee, column_name
  from information_schema.column_privileges
 where table_name = 'profiles' and table_schema in ('public', 'gema')
   and grantee in ('authenticated', 'anon') and privilege_type = 'UPDATE'
 order by table_schema, grantee, column_name;

-- C. What is public.profiles.role, and does anything authorize off it?
--    No Lifestyle migration creates this column. Until its purpose is known,
--    the migration simply stops members writing it.
select a.attname, format_type(a.atttypid, a.atttypmod) as type, a.attnotnull
  from pg_attribute a
 where a.attrelid = 'public.profiles'::regclass
   and a.attname in ('role', 'account_status')
   and a.attnum > 0;

select n.nspname as schema, p.proname, pg_get_functiondef(p.oid) as body
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where p.proname in ('is_admin', 'lifestyle_is_admin')
 order by n.nspname, p.proname;

-- D. Dependencies the migration checks for. Both must be true, or it aborts
--    whole rather than half-applying.
select to_regprocedure('public.lifestyle_is_admin(uuid)') is not null as has_lifestyle_is_admin,
       to_regclass('public.app_roles')                    is not null as has_app_roles;

-- E. Who is already an admin, on either table.
select 'public' as src, id, name, role::text, card_no from public.profiles where role::text = 'admin'
union all
select 'gema', id, full_name, role::text, null from gema.profiles where role::text = 'admin' or is_admin
union all
select 'app_roles', user_id, null, role, null from public.app_roles;

-- F. What a new Auth user actually writes today.
select n.nspname as schema, p.proname, pg_get_functiondef(p.oid) as body
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where p.oid in (select tgfoid from pg_trigger
                  where tgrelid = 'auth.users'::regclass and not tgisinternal);

-- G. The reconcile problem: Auth users missing from each person table.
select u.id, u.email, u.created_at,
       (p.id is not null) as has_public_profile,
       (g.id is not null) as has_gema_profile
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join gema.profiles  g on g.id = u.id
 where p.id is null or g.id is null
 order by u.created_at;
