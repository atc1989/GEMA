-- The Staging (fxdsnacuonfvutdquogb) shape of public.profiles, reproduced on a
-- plain Postgres so change3_shared_person_profiles.sql can be applied and
-- tested before it is pointed at a real database.
--
-- The column list is the one the preflight returned on 2026-09-04, in order.
-- The policies and public.is_admin() are copied from ../schema.sql and
-- ../member_event_publishing_permissions.sql, which is the last file to
-- redefine profiles_update_own.
create extension if not exists citext;

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

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext unique,
  first_name text,
  last_name text,
  full_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  phone text,
  role public.app_role not null default 'prospect',
  is_admin boolean not null default false,
  avatar_url text,
  last_seen_at timestamptz,
  can_publish_events boolean not null default false
);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and (is_admin = true or role = 'admin')) $$;

alter table public.profiles enable row level security;

create policy "profiles_select_own_or_admin" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid() and is_admin = false);
create policy "profiles_admin_all" on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- Supabase grants ALL on public tables to anon/authenticated by default. This
-- is what makes the whole-row UPDATE reachable, and what the migration revokes.
grant usage on schema public, auth to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all functions in schema public to anon, authenticated;
grant select on auth.users to authenticated;
