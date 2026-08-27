-- Unified GutGuard identity schema.
-- PROPOSAL ONLY. Do not run this on production (rvwseybgimmewuoccecu).
-- Intended first target: GutGuard Staging (fxdsnacuonfvutdquogb), after
-- docs/unified-profile.md Phase 0 decisions.
--
-- This file is additive. It does not drop gema.profiles, public.profiles,
-- academy.handle_new_user, or Lifestyle columns. Dual-write comes later.

create extension if not exists citext;
create extension if not exists pgcrypto;

create schema if not exists identity;
revoke all on schema identity from public;
grant usage on schema identity to postgres, service_role, authenticated, anon;

do $$ begin
  create type identity.account_status as enum (
    'invited',
    'active',
    'suspended',
    'closed'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type identity.product_code as enum (
    'gema',
    'academy',
    'lifestyle'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type identity.access_status as enum (
    'invited',
    'active',
    'suspended',
    'closed'
  );
exception when duplicate_object then null;
end $$;

create or replace function identity.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Layer 2: the person. Product fields do not belong here.
create table if not exists identity.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext unique,
  full_name text not null,
  first_name text,
  last_name text,
  phone text,
  avatar_url text,
  locale text not null default 'en',
  timezone text not null default 'Asia/Manila',
  account_status identity.account_status not null default 'active',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists identity_profiles_phone_uidx
  on identity.profiles (phone)
  where phone is not null;

create index if not exists identity_profiles_account_status_idx
  on identity.profiles (account_status);

create or replace function identity.normalize_ph_phone(p_phone text)
returns text
language sql
immutable
as $$
  select case
    when p_phone is null or length(btrim(p_phone)) = 0 then null
    when btrim(p_phone) ~ '^\+[1-9][0-9]{7,14}$' then btrim(p_phone)
    when btrim(p_phone) ~ '^09[0-9]{9}$' then '+63' || substring(btrim(p_phone) from 2)
    when btrim(p_phone) ~ '^9[0-9]{9}$' then '+63' || btrim(p_phone)
    else btrim(p_phone)
  end;
$$;

create or replace function identity.prevent_self_status_change()
returns trigger
language plpgsql
as $$
begin
  if new.account_status is distinct from old.account_status
     and auth.uid() is not null
     and auth.uid() = old.id
     and not (
       identity.has_role('gema', 'admin', auth.uid())
       or identity.has_role('academy', 'admin', auth.uid())
     )
  then
    raise exception 'account_status cannot be changed by the account holder';
  end if;
  return new;
end;
$$;

drop trigger if exists identity_profiles_set_updated_at on identity.profiles;
create trigger identity_profiles_set_updated_at
before update on identity.profiles
for each row execute function identity.set_updated_at();

drop trigger if exists identity_profiles_prevent_self_status on identity.profiles;
create trigger identity_profiles_prevent_self_status
before update of account_status on identity.profiles
for each row execute function identity.prevent_self_status_change();

-- Layer 3: which apps this person may enter.
create table if not exists identity.product_access (
  profile_id uuid not null references identity.profiles (id) on delete cascade,
  product identity.product_code not null,
  status identity.access_status not null default 'active',
  granted_at timestamptz not null default now(),
  granted_by uuid references identity.profiles (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, product)
);

drop trigger if exists identity_product_access_set_updated_at on identity.product_access;
create trigger identity_product_access_set_updated_at
before update on identity.product_access
for each row execute function identity.set_updated_at();

-- Layer 4: product-scoped roles. No global app_role enum.
create table if not exists identity.roles (
  profile_id uuid not null references identity.profiles (id) on delete cascade,
  product identity.product_code not null,
  role text not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, product, role),
  constraint identity_roles_role_nonempty check (length(btrim(role)) > 0)
);

create index if not exists identity_roles_product_role_idx
  on identity.roles (product, role);

-- Signup must create a person row only. It must not enrol Academy BASE
-- or grant GEMA membership. The calling product writes product_access.
create or replace function identity.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = identity, public
as $$
declare
  v_full_name text;
begin
  v_full_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(trim(concat_ws(' ',
      new.raw_user_meta_data ->> 'first_name',
      new.raw_user_meta_data ->> 'last_name')), ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'username', ''),
    split_part(new.email, '@', 1),
    'Member'
  );

  insert into identity.profiles (
    id,
    email,
    full_name,
    first_name,
    last_name,
    phone,
    locale
  )
  values (
    new.id,
    new.email,
    v_full_name,
    nullif(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(new.raw_user_meta_data ->> 'last_name', ''),
    identity.normalize_ph_phone(
      coalesce(
        new.raw_user_meta_data ->> 'phone',
        new.raw_user_meta_data ->> 'mobile',
        new.phone
      )
    ),
    coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'en')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Install this trigger on Staging only after academy.handle_new_user and
-- public.handle_new_user are dropped or rewritten to call identity.handle_new_user.
-- Left commented so a careless apply cannot double-enrol users.
--
-- drop trigger if exists on_auth_user_created_identity on auth.users;
-- create trigger on_auth_user_created_identity
-- after insert on auth.users
-- for each row execute function identity.handle_new_user();

create or replace function identity.has_product_access(
  p_product identity.product_code,
  p_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = identity
as $$
  select exists (
    select 1
    from identity.profiles p
    join identity.product_access a
      on a.profile_id = p.id
    where p.id = p_user
      and p.account_status = 'active'
      and a.product = p_product
      and a.status = 'active'
  );
$$;

create or replace function identity.has_role(
  p_product identity.product_code,
  p_role text,
  p_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = identity
as $$
  select exists (
    select 1
    from identity.roles r
    join identity.profiles p on p.id = r.profile_id
    join identity.product_access a
      on a.profile_id = r.profile_id
     and a.product = r.product
    where r.profile_id = p_user
      and r.product = p_product
      and r.role = p_role
      and p.account_status = 'active'
      and a.status = 'active'
  );
$$;

create or replace function identity.grant_product_access(
  p_profile_id uuid,
  p_product identity.product_code,
  p_role text default 'member',
  p_source text default 'admin'
)
returns jsonb
language plpgsql
security definer
set search_path = identity
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- First admin must be inserted with the service role (SQL editor), then
  -- this RPC can grant further seats. There is no self-serve admin grant.
  if not (
    identity.has_role(p_product, 'admin')
    or identity.has_role('gema', 'admin')
    or identity.has_role('academy', 'admin')
  ) then
    raise exception 'Not allowed';
  end if;

  insert into identity.product_access (profile_id, product, status, granted_by, metadata)
  values (
    p_profile_id,
    p_product,
    'active',
    auth.uid(),
    jsonb_build_object('source', coalesce(p_source, 'admin'))
  )
  on conflict (profile_id, product) do update
    set status = 'active',
        updated_at = now();

  if p_role is not null then
    insert into identity.roles (profile_id, product, role)
    values (p_profile_id, p_product, p_role)
    on conflict do nothing;
  end if;

  return jsonb_build_object('ok', true, 'product', p_product, 'role', p_role);
end;
$$;

alter table identity.profiles enable row level security;
alter table identity.product_access enable row level security;
alter table identity.roles enable row level security;

drop policy if exists identity_profiles_select_own on identity.profiles;
create policy identity_profiles_select_own
on identity.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists identity_profiles_update_own on identity.profiles;
create policy identity_profiles_update_own
on identity.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists identity_product_access_select_own on identity.product_access;
create policy identity_product_access_select_own
on identity.product_access
for select
to authenticated
using (profile_id = auth.uid());

drop policy if exists identity_roles_select_own on identity.roles;
create policy identity_roles_select_own
on identity.roles
for select
to authenticated
using (profile_id = auth.uid());

grant select, update on identity.profiles to authenticated;
grant select on identity.product_access to authenticated;
grant select on identity.roles to authenticated;
grant execute on function identity.has_product_access(identity.product_code, uuid) to authenticated, anon;
grant execute on function identity.has_role(identity.product_code, text, uuid) to authenticated, anon;
grant execute on function identity.grant_product_access(uuid, identity.product_code, text, text) to authenticated;

-- Self-insert is denied. The trigger (service role / security definer) creates
-- the profile. Product access and roles are denied to authenticated writes
-- except through grant_product_access.
revoke insert, delete on identity.profiles from authenticated, anon;
revoke insert, update, delete on identity.product_access from authenticated, anon;
revoke insert, update, delete on identity.roles from authenticated, anon;
