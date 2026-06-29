-- GEMA migration for the existing Supabase project.
-- Existing tables preserved:
-- profiles, products, orders, order_items, addresses.

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists ltree;

do $$ begin create type public.app_role as enum ('prospect', 'member', 'host', 'admin'); exception when duplicate_object then null; end $$;
do $$ begin create type public.member_status as enum ('pending', 'active', 'suspended', 'inactive'); exception when duplicate_object then null; end $$;
do $$ begin create type public.prospect_stage as enum ('new', 'registered', 'attended', 'followup', 'converted', 'expired'); exception when duplicate_object then null; end $$;
do $$ begin create type public.event_type as enum ('presentation', 'business', 'training', 'sizzle', 'mentoring', 'fellowship', 'other'); exception when duplicate_object then null; end $$;
do $$ begin create type public.event_visibility as enum ('public', 'private'); exception when duplicate_object then null; end $$;
do $$ begin create type public.event_mode as enum ('in_person', 'online', 'hybrid'); exception when duplicate_object then null; end $$;
do $$ begin create type public.event_status as enum ('draft', 'published', 'cancelled', 'completed', 'archived'); exception when duplicate_object then null; end $$;
do $$ begin create type public.registration_status as enum ('registered', 'cancelled', 'attended', 'no_show', 'converted'); exception when duplicate_object then null; end $$;
do $$ begin create type public.registration_kind as enum ('member', 'prospect'); exception when duplicate_object then null; end $$;
do $$ begin create type public.registration_source as enum ('public_invite', 'member_referral', 'member_rsvp', 'admin'); exception when duplicate_object then null; end $$;
do $$ begin create type public.attendance_status as enum ('checked_in', 'manual_confirmed', 'voided'); exception when duplicate_object then null; end $$;
do $$ begin create type public.referral_status as enum ('active', 'claimed', 'expired', 'converted', 'cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.commission_status as enum ('pending', 'approved', 'paid', 'reversed', 'void'); exception when duplicate_object then null; end $$;
do $$ begin create type public.notification_channel as enum ('in_app', 'email', 'sms', 'push', 'webhook'); exception when duplicate_object then null; end $$;
do $$ begin create type public.notification_status as enum ('queued', 'sent', 'failed', 'read', 'cancelled'); exception when duplicate_object then null; end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.profiles
  add column if not exists role public.app_role not null default 'prospect',
  add column if not exists is_admin boolean not null default false,
  add column if not exists avatar_url text,
  add column if not exists last_seen_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'profiles_set_updated_at') then
    create trigger profiles_set_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();
  end if;
end $$;

create table if not exists public.ranks (
  id smallserial primary key,
  code text not null unique,
  name text not null,
  level integer not null unique check (level >= 0),
  description text,
  requirements jsonb not null default '{}'::jsonb,
  commission_rate_bps integer not null default 0 check (commission_rate_bps between 0 and 10000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  rank_id smallint references public.ranks(id),
  sponsor_member_id uuid references public.members(id) on delete set null,
  member_code text not null unique,
  username citext not null unique,
  status public.member_status not null default 'pending',
  joined_at timestamptz,
  activated_at timestamptz,
  no_zero_current_streak integer not null default 0 check (no_zero_current_streak >= 0),
  no_zero_best_streak integer not null default 0 check (no_zero_best_streak >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint members_no_self_sponsor check (sponsor_member_id is null or sponsor_member_id <> id)
);

create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  sponsor_member_id uuid references public.members(id) on delete set null,
  converted_member_id uuid unique references public.members(id) on delete set null,
  converted_order_id uuid references public.orders(id) on delete set null,
  full_name text not null,
  phone text,
  email citext,
  stage public.prospect_stage not null default 'new',
  source text,
  attribution_expires_at timestamptz,
  consent_privacy boolean not null default false,
  consent_marketing boolean not null default false,
  last_contacted_at timestamptz,
  converted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  host_member_id uuid references public.members(id) on delete set null,
  title text not null,
  slug text not null unique,
  event_type public.event_type not null,
  visibility public.event_visibility not null default 'public',
  mode public.event_mode not null default 'in_person',
  status public.event_status not null default 'draft',
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null default 'Asia/Manila',
  venue_name text,
  venue_address text,
  map_url text,
  online_url text,
  capacity integer check (capacity is null or capacity > 0),
  description text,
  banner_url text,
  cancelled_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_time_order check (ends_at is null or ends_at > starts_at)
);

create table if not exists public.event_speakers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  member_id uuid references public.members(id) on delete set null,
  name text not null,
  role_title text,
  photo_url text,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  ref_code text not null unique,
  referrer_member_id uuid not null references public.members(id) on delete cascade,
  referred_profile_id uuid references public.profiles(id) on delete set null,
  prospect_id uuid references public.prospects(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  converted_order_id uuid references public.orders(id) on delete set null,
  status public.referral_status not null default 'active',
  source_url text,
  first_clicked_at timestamptz,
  claimed_at timestamptz,
  expires_at timestamptz,
  converted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  member_id uuid references public.members(id) on delete set null,
  prospect_id uuid references public.prospects(id) on delete set null,
  referral_id uuid references public.referrals(id) on delete set null,
  sponsor_member_id uuid references public.members(id) on delete set null,
  registration_kind public.registration_kind not null,
  status public.registration_status not null default 'registered',
  source public.registration_source not null default 'public_invite',
  pass_code text not null unique,
  qr_payload text not null unique,
  attendee_name text not null,
  attendee_phone text,
  attendee_email citext,
  consent_privacy boolean not null default false,
  consent_marketing boolean not null default false,
  registered_at timestamptz not null default now(),
  cancelled_at timestamptz,
  attended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint registration_identity check (
    (registration_kind = 'member' and member_id is not null)
    or (registration_kind = 'prospect' and prospect_id is not null)
  )
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  registration_id uuid not null unique references public.event_registrations(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  prospect_id uuid references public.prospects(id) on delete set null,
  checked_in_by_profile_id uuid references public.profiles(id) on delete set null,
  status public.attendance_status not null default 'checked_in',
  checked_in_at timestamptz not null default now(),
  qr_payload text,
  device_id text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.genealogy (
  ancestor_member_id uuid not null references public.members(id) on delete cascade,
  descendant_member_id uuid not null references public.members(id) on delete cascade,
  depth integer not null check (depth >= 0),
  path ltree,
  created_at timestamptz not null default now(),
  primary key (ancestor_member_id, descendant_member_id),
  constraint genealogy_no_self_depth_mismatch check (
    (ancestor_member_id = descendant_member_id and depth = 0)
    or (ancestor_member_id <> descendant_member_id and depth > 0)
  )
);

create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  earner_member_id uuid not null references public.members(id) on delete restrict,
  source_member_id uuid references public.members(id) on delete set null,
  source_prospect_id uuid references public.prospects(id) on delete set null,
  referral_id uuid references public.referrals(id) on delete set null,
  registration_id uuid references public.event_registrations(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  order_item_id uuid references public.order_items(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  rank_id smallint references public.ranks(id),
  level_depth integer not null default 0 check (level_depth >= 0),
  basis_amount numeric(12, 2) not null default 0 check (basis_amount >= 0),
  commission_rate_bps integer not null default 0 check (commission_rate_bps between 0 and 10000),
  amount numeric(12, 2) not null check (amount >= 0),
  currency char(3) not null default 'PHP',
  status public.commission_status not null default 'pending',
  period_start date,
  period_end date,
  approved_at timestamptz,
  paid_at timestamptz,
  reversed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid references public.profiles(id) on delete cascade,
  recipient_member_id uuid references public.members(id) on delete cascade,
  recipient_prospect_id uuid references public.prospects(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  notification_type text not null,
  channel public.notification_channel not null default 'in_app',
  status public.notification_status not null default 'queued',
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz,
  sent_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notifications_has_recipient check (
    recipient_profile_id is not null
    or recipient_member_id is not null
    or recipient_prospect_id is not null
  )
);

do $$ declare t text; begin
  foreach t in array array['ranks','members','prospects','events','event_speakers','referrals','event_registrations','attendance_records','commissions','notifications'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_set_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_set_updated_at', t);
  end loop;
end $$;

create unique index if not exists event_registrations_one_active_member_per_event
on public.event_registrations(event_id, member_id)
where member_id is not null and status <> 'cancelled';

create unique index if not exists event_registrations_one_active_prospect_per_event
on public.event_registrations(event_id, prospect_id)
where prospect_id is not null and status <> 'cancelled';

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_phone_idx on public.profiles(phone) where phone is not null;
create index if not exists orders_user_created_idx on public.orders(user_id, created_at desc);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists order_items_product_idx on public.order_items(product_id);
create index if not exists products_active_idx on public.products(active);
create index if not exists members_profile_idx on public.members(profile_id);
create index if not exists members_sponsor_idx on public.members(sponsor_member_id);
create index if not exists members_rank_idx on public.members(rank_id);
create index if not exists prospects_sponsor_stage_idx on public.prospects(sponsor_member_id, stage);
create index if not exists events_status_starts_idx on public.events(status, starts_at);
create index if not exists events_public_starts_idx on public.events(starts_at) where visibility = 'public' and status = 'published';
create index if not exists event_speakers_event_sort_idx on public.event_speakers(event_id, sort_order);
create index if not exists referrals_referrer_status_idx on public.referrals(referrer_member_id, status);
create index if not exists referrals_converted_order_idx on public.referrals(converted_order_id) where converted_order_id is not null;
create index if not exists registrations_event_status_idx on public.event_registrations(event_id, status);
create index if not exists registrations_sponsor_idx on public.event_registrations(sponsor_member_id) where sponsor_member_id is not null;
create index if not exists attendance_event_checked_idx on public.attendance_records(event_id, checked_in_at desc);
create index if not exists genealogy_descendant_depth_idx on public.genealogy(descendant_member_id, depth);
create index if not exists genealogy_ancestor_depth_idx on public.genealogy(ancestor_member_id, depth);
create index if not exists commissions_earner_period_idx on public.commissions(earner_member_id, period_start, period_end);
create index if not exists commissions_order_idx on public.commissions(order_id) where order_id is not null;
create index if not exists commissions_product_idx on public.commissions(product_id) where product_id is not null;
create index if not exists notifications_recipient_profile_idx on public.notifications(recipient_profile_id, status, created_at desc);
create index if not exists notifications_scheduled_idx on public.notifications(scheduled_for) where status = 'queued';

create or replace function public.current_profile_id()
returns uuid language sql stable as $$ select auth.uid() $$;

create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.members where profile_id = auth.uid() and status = 'active' limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (is_admin = true or role = 'admin')
  )
$$;

create or replace function public.can_manage_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.events e
      left join public.members m on m.id = e.host_member_id
      where e.id = target_event_id
        and (e.created_by_profile_id = auth.uid() or m.profile_id = auth.uid())
    )
$$;

create or replace function public.can_write_event_row(
  target_created_by_profile_id uuid,
  target_host_member_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (
      public.is_admin()
      or target_created_by_profile_id = auth.uid()
      or exists (
        select 1
        from public.members m
        where m.id = target_host_member_id
          and m.profile_id = auth.uid()
      )
    )
$$;

alter table public.ranks enable row level security;
alter table public.members enable row level security;
alter table public.prospects enable row level security;
alter table public.events enable row level security;
alter table public.event_speakers enable row level security;
alter table public.referrals enable row level security;
alter table public.event_registrations enable row level security;
alter table public.attendance_records enable row level security;
alter table public.genealogy enable row level security;
alter table public.commissions enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "ranks_read_active" on public.ranks;
create policy "ranks_read_active" on public.ranks for select using (active = true or public.is_admin());

drop policy if exists "members_select_self_upline_downline_or_admin" on public.members;
create policy "members_select_self_upline_downline_or_admin" on public.members for select using (
  profile_id = auth.uid()
  or sponsor_member_id = public.current_member_id()
  or public.is_admin()
  or exists (
    select 1 from public.genealogy g
    where g.ancestor_member_id = public.current_member_id()
      and g.descendant_member_id = members.id
      and g.depth between 1 and 10
  )
);

drop policy if exists "members_admin_all" on public.members;
create policy "members_admin_all" on public.members for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "prospects_insert_public" on public.prospects;
create policy "prospects_insert_public" on public.prospects for insert with check (
  consent_privacy = true
  and profile_id is null
  and converted_member_id is null
  and converted_at is null
  and stage in ('new', 'registered')
);

drop policy if exists "prospects_select_owner_sponsor_or_admin" on public.prospects;
create policy "prospects_select_owner_sponsor_or_admin" on public.prospects for select using (
  profile_id = auth.uid()
  or sponsor_member_id = public.current_member_id()
  or public.is_admin()
);

drop policy if exists "events_select_published_public" on public.events;
create policy "events_select_published_public" on public.events for select using (
  (status = 'published' and visibility = 'public')
  or public.can_manage_event(id)
);

drop policy if exists "events_insert_authenticated" on public.events;
create policy "events_insert_authenticated" on public.events for insert
with check (public.can_write_event_row(created_by_profile_id, host_member_id));

drop policy if exists "events_manage_owner_or_admin" on public.events;
create policy "events_manage_owner_or_admin" on public.events for update
using (public.can_manage_event(id))
with check (public.can_write_event_row(created_by_profile_id, host_member_id));

drop policy if exists "events_delete_admin" on public.events;
create policy "events_delete_admin" on public.events for delete
using (public.is_admin());

drop policy if exists "event_speakers_select_visible_events" on public.event_speakers;
create policy "event_speakers_select_visible_events" on public.event_speakers for select using (
  exists (
    select 1 from public.events e
    where e.id = event_speakers.event_id
      and ((e.status = 'published' and e.visibility = 'public') or public.can_manage_event(e.id))
  )
);

drop policy if exists "event_speakers_manage_event" on public.event_speakers;
create policy "event_speakers_manage_event" on public.event_speakers for all
using (public.can_manage_event(event_id))
with check (public.can_manage_event(event_id));

drop policy if exists "referrals_select_owner_referred_or_admin" on public.referrals;
create policy "referrals_select_owner_referred_or_admin" on public.referrals for select using (
  referrer_member_id = public.current_member_id()
  or referred_profile_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "registrations_insert_public_or_member" on public.event_registrations;
create policy "registrations_insert_public_or_member" on public.event_registrations for insert with check (
  exists (
    select 1 from public.events e
    where e.id = event_id
      and e.status = 'published'
      and e.visibility = 'public'
  )
  and consent_privacy = true
  and status = 'registered'
  and attended_at is null
  and cancelled_at is null
);

drop policy if exists "registrations_select_self_sponsor_event_manager_or_admin" on public.event_registrations;
create policy "registrations_select_self_sponsor_event_manager_or_admin" on public.event_registrations for select using (
  profile_id = auth.uid()
  or member_id = public.current_member_id()
  or sponsor_member_id = public.current_member_id()
  or public.can_manage_event(event_id)
  or public.is_admin()
);

drop policy if exists "attendance_select_self_sponsor_event_manager_or_admin" on public.attendance_records;
create policy "attendance_select_self_sponsor_event_manager_or_admin" on public.attendance_records for select using (
  member_id = public.current_member_id()
  or public.can_manage_event(event_id)
  or public.is_admin()
);

drop policy if exists "attendance_insert_event_manager" on public.attendance_records;
create policy "attendance_insert_event_manager" on public.attendance_records for insert with check (public.can_manage_event(event_id));

drop policy if exists "genealogy_select_self_network_or_admin" on public.genealogy;
create policy "genealogy_select_self_network_or_admin" on public.genealogy for select using (
  ancestor_member_id = public.current_member_id()
  or descendant_member_id = public.current_member_id()
  or public.is_admin()
);

drop policy if exists "commissions_select_earner_or_admin" on public.commissions;
create policy "commissions_select_earner_or_admin" on public.commissions for select using (
  earner_member_id = public.current_member_id()
  or public.is_admin()
);

drop policy if exists "commissions_admin_all" on public.commissions;
create policy "commissions_admin_all" on public.commissions for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "notifications_select_recipient_or_admin" on public.notifications;
create policy "notifications_select_recipient_or_admin" on public.notifications for select using (
  recipient_profile_id = auth.uid()
  or recipient_member_id = public.current_member_id()
  or public.is_admin()
);

insert into public.ranks (code, name, level, description, requirements, commission_rate_bps)
values
  ('PROSPECT', 'Prospect', 0, 'Pre-member or guest state.', '{}'::jsonb, 0),
  ('SL', 'Squad Leader', 10, 'Active builder with direct invite activity.', '{"direct_members": 1}'::jsonb, 500),
  ('PL', 'Platoon Leader', 20, 'Leader with active downline depth.', '{"direct_members": 5, "active_downline": 20}'::jsonb, 700)
on conflict (code) do nothing;
