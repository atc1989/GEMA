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

-- Lifestyle's admin RBAC (20260902000000) is deliberately NOT created here.
-- public.app_roles does not exist on Staging -- confirmed 2026-09-04 by an
-- error from the preflight -- so neither does lifestyle_is_admin(). The card
-- table landed there; the RBAC did not. The fixture has to be missing it too,
-- or the migration would be tested against a database more complete than the
-- real one.

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Supabase grants ALL on public tables to anon/authenticated by default. This
-- is what makes the whole-row UPDATE reachable, and what the migration revokes.
grant usage on schema public, auth, gema to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all functions in schema public to anon, authenticated;
grant select on auth.users to authenticated;

-- Staging's actual data situation (section G, 2026-09-04): 15 Auth users, none
-- with a public.profiles row, 9 with a gema.profiles row, 6 with neither.
-- Scaled down but the same three shapes.
insert into auth.users (id, email, raw_user_meta_data) values
  ('dddd0000-0000-0000-0000-000000000001','has.gema@example.invalid','{"full_name":"Has Gema"}'),
  ('dddd0000-0000-0000-0000-000000000002','names.only@example.invalid','{}'),
  ('dddd0000-0000-0000-0000-000000000003','orphan.one@example.invalid','{"full_name":"Orphan One"}'),
  ('dddd0000-0000-0000-0000-000000000004','orphan.two@example.invalid','{}');

insert into gema.profiles (id, email, full_name, phone) values
  ('dddd0000-0000-0000-0000-000000000001','has.gema@example.invalid','Has Gema','09990000101');
insert into gema.profiles (id, email, first_name, last_name, full_name) values
  ('dddd0000-0000-0000-0000-000000000002','names.only@example.invalid','Names','Only','');

-- Change 4 fixture: the card numbers as they actually are before the Change.
-- Every member registered through Lifestyle got the same literal string from
-- lib/mock/seed.ts, there is no unique index, and nothing objected.
insert into auth.users (id, email, raw_user_meta_data) values
  ('eeee0000-0000-0000-0000-000000000001','legacy.one@example.invalid','{"full_name":"Legacy One"}'),
  ('eeee0000-0000-0000-0000-000000000002','legacy.two@example.invalid','{"full_name":"Legacy Two"}'),
  ('eeee0000-0000-0000-0000-000000000003','dup.early@example.invalid','{"full_name":"Dup Early"}'),
  ('eeee0000-0000-0000-0000-000000000004','dup.late@example.invalid','{"full_name":"Dup Late"}'),
  ('eeee0000-0000-0000-0000-000000000005','blank.card@example.invalid','{"full_name":"Blank Card"}'),
  ('eeee0000-0000-0000-0000-000000000006','real.card@example.invalid','{"full_name":"Real Card"}');

insert into public.profiles (id, name, mobile, email, card_no, points, phase, created_at) values
  -- The placeholder, twice, and once with the spacing a hand-edit leaves behind.
  ('eeee0000-0000-0000-0000-000000000001','Legacy One','09990000201','legacy.one@example.invalid','0240 5578 9012 3456', 120, 'claimed', '2026-08-01'),
  ('eeee0000-0000-0000-0000-000000000002','Legacy Two','09990000202','legacy.two@example.invalid','0240  5578 9012 3456',  0, 'invited', '2026-08-02'),
  -- A duplicate that is not the placeholder. The earliest row keeps it.
  ('eeee0000-0000-0000-0000-000000000003','Dup Early','09990000203','dup.early@example.invalid','0240 1111 2222 3333',  5, 'invited', '2026-08-03'),
  ('eeee0000-0000-0000-0000-000000000004','Dup Late','09990000204','dup.late@example.invalid','0240 1111 2222 3333',  7, 'invited', '2026-08-04'),
  ('eeee0000-0000-0000-0000-000000000005','Blank Card','09990000205','blank.card@example.invalid','   ', 0, 'invited', '2026-08-05'),
  ('eeee0000-0000-0000-0000-000000000006','Real Card','09990000206','real.card@example.invalid','0240 9999 8888 7777', 42, 'member', '2026-08-06');
