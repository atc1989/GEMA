-- The Staging (fxdsnacuonfvutdquogb) shape, reproduced on a plain Postgres.
--
-- Both tables named "profiles", as section 0 returned them on 2026-09-04. The
-- migration touches public.profiles only; gema.profiles is here so the fixture
-- cannot silently pass by resolving the wrong one.
create extension if not exists citext;
create extension if not exists pgcrypto;

create role anon; create role authenticated; create role service_role;

create schema auth;
create table auth.users (
  id uuid primary key, email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated') $$;

create type public.app_role as enum ('prospect', 'member', 'host', 'admin');

-- public.profiles: the Lifestyle card table plus the `role` column that is on
-- Staging and in no Lifestyle migration. Typed as app_role here; if Staging has
-- it as text the migration is unaffected -- it only revokes the grant.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  mobile text not null,
  email text,
  sponsor text not null default 'Ate Marites',
  team text not null default 'GenSan',
  card_no text not null,
  phase text not null default 'invited',
  claimed boolean not null default false,
  points integer not null default 0,
  pending integer not null default 0,
  banked integer not null default 0,
  days_left integer not null default -1,
  capsules_per_day integer not null default 2 check (capsules_per_day between 2 and 3),
  telegram boolean not null default false,
  facebook boolean not null default false,
  notifications boolean not null default true,
  welcome_seen boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  role public.app_role not null default 'prospect'
);

-- gema.profiles: GEMA's person table. Not touched by the migration.
create schema gema;
create table gema.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext unique, first_name text, last_name text, full_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  phone text, role public.app_role not null default 'prospect',
  is_admin boolean not null default false, avatar_url text,
  last_seen_at timestamptz, can_publish_events boolean not null default false
);

-- Lifestyle admin RBAC (20260902000000), which the migration depends on.
create table public.app_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin')),
  created_at timestamptz not null default now()
);
create function public.lifestyle_is_admin(p_user uuid default auth.uid())
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (select 1 from public.app_roles where user_id = p_user and role = 'admin') $$;

alter table public.profiles enable row level security;
alter table public.app_roles enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_select_admin on public.profiles
  for select to authenticated using (public.lifestyle_is_admin());

-- Supabase grants ALL on public tables to anon/authenticated by default. This
-- is what makes the whole-row UPDATE reachable, and what the migration revokes.
grant usage on schema public, auth, gema to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all functions in schema public to anon, authenticated;
grant select on auth.users to authenticated;
