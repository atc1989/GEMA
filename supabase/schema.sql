-- GEMA Supabase schema for a fresh database.
-- Do not run this file directly on an existing Supabase project that already
-- has profiles/orders/products tables. Use gema_existing_project_migration.sql
-- for the current project.
-- Data architecture for public prospect invites, member dashboard, admin event
-- management, MLM genealogy, QR attendance, commissions, and notifications.

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists ltree;

create type public.app_role as enum ('prospect', 'member', 'host', 'admin');
create type public.member_status as enum ('pending', 'active', 'suspended', 'inactive');
create type public.prospect_stage as enum ('new', 'registered', 'attended', 'followup', 'converted', 'expired');
create type public.event_type as enum ('presentation', 'business', 'training', 'sizzle', 'mentoring', 'fellowship', 'other');
create type public.event_visibility as enum ('public', 'private', 'company_support');
create type public.event_mode as enum ('in_person', 'online', 'hybrid');
create type public.event_status as enum ('draft', 'published', 'cancelled', 'completed', 'archived');
create type public.registration_status as enum ('registered', 'cancelled', 'attended', 'no_show', 'converted');
create type public.registration_kind as enum ('member', 'prospect');
create type public.registration_source as enum ('public_invite', 'member_referral', 'member_rsvp', 'admin');
create type public.attendance_status as enum ('checked_in', 'manual_confirmed', 'voided');
create type public.referral_status as enum ('active', 'claimed', 'expired', 'converted', 'cancelled');
create type public.commission_status as enum ('pending', 'approved', 'paid', 'reversed', 'void');
create type public.notification_channel as enum ('in_app', 'email', 'sms', 'push', 'webhook');
create type public.notification_status as enum ('queued', 'sent', 'failed', 'read', 'cancelled');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext unique,
  full_name text not null,
  phone text,
  avatar_url text,
  role public.app_role not null default 'prospect',
  is_admin boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create table public.ranks (
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

create trigger ranks_set_updated_at
before update on public.ranks
for each row execute function public.set_updated_at();

create table public.members (
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

create trigger members_set_updated_at
before update on public.members
for each row execute function public.set_updated_at();

create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  sponsor_member_id uuid references public.members(id) on delete set null,
  converted_member_id uuid unique references public.members(id) on delete set null,
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

create trigger prospects_set_updated_at
before update on public.prospects
for each row execute function public.set_updated_at();

create table public.events (
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

create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create table public.event_speakers (
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

create trigger event_speakers_set_updated_at
before update on public.event_speakers
for each row execute function public.set_updated_at();

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  ref_code text not null unique,
  referrer_member_id uuid not null references public.members(id) on delete cascade,
  referred_profile_id uuid references public.profiles(id) on delete set null,
  prospect_id uuid references public.prospects(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
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

create trigger referrals_set_updated_at
before update on public.referrals
for each row execute function public.set_updated_at();

create table public.event_registrations (
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
  admin_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint registration_identity check (
    (registration_kind = 'member' and member_id is not null)
    or (registration_kind = 'prospect' and prospect_id is not null)
  )
);

create unique index event_registrations_one_active_member_per_event
on public.event_registrations(event_id, member_id)
where member_id is not null and status <> 'cancelled';

create unique index event_registrations_one_active_prospect_per_event
on public.event_registrations(event_id, prospect_id)
where prospect_id is not null and status <> 'cancelled';

create trigger event_registrations_set_updated_at
before update on public.event_registrations
for each row execute function public.set_updated_at();

create table public.attendance_records (
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

create trigger attendance_records_set_updated_at
before update on public.attendance_records
for each row execute function public.set_updated_at();

create table public.genealogy (
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

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  earner_member_id uuid not null references public.members(id) on delete restrict,
  source_member_id uuid references public.members(id) on delete set null,
  source_prospect_id uuid references public.prospects(id) on delete set null,
  referral_id uuid references public.referrals(id) on delete set null,
  registration_id uuid references public.event_registrations(id) on delete set null,
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

create trigger commissions_set_updated_at
before update on public.commissions
for each row execute function public.set_updated_at();

create table public.notifications (
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

create trigger notifications_set_updated_at
before update on public.notifications
for each row execute function public.set_updated_at();

-- Indexes
create index profiles_role_idx on public.profiles(role);
create index profiles_phone_idx on public.profiles(phone) where phone is not null;

create index members_profile_idx on public.members(profile_id);
create index members_sponsor_idx on public.members(sponsor_member_id);
create index members_rank_idx on public.members(rank_id);
create index members_status_idx on public.members(status);

create index prospects_sponsor_stage_idx on public.prospects(sponsor_member_id, stage);
create index prospects_email_idx on public.prospects(email) where email is not null;
create index prospects_phone_idx on public.prospects(phone) where phone is not null;
create index prospects_converted_member_idx on public.prospects(converted_member_id) where converted_member_id is not null;

create index events_status_starts_idx on public.events(status, starts_at);
create index events_public_starts_idx on public.events(starts_at) where visibility = 'public' and status = 'published';
create index events_host_member_idx on public.events(host_member_id);
create index events_created_by_idx on public.events(created_by_profile_id);
create index events_type_idx on public.events(event_type);

create index event_speakers_event_sort_idx on public.event_speakers(event_id, sort_order);
create index event_speakers_member_idx on public.event_speakers(member_id) where member_id is not null;

create index referrals_referrer_status_idx on public.referrals(referrer_member_id, status);
create index referrals_prospect_idx on public.referrals(prospect_id) where prospect_id is not null;
create index referrals_event_idx on public.referrals(event_id) where event_id is not null;
create index referrals_expires_idx on public.referrals(expires_at) where status = 'active';

create index registrations_event_status_idx on public.event_registrations(event_id, status);
create index registrations_member_idx on public.event_registrations(member_id) where member_id is not null;
create index registrations_prospect_idx on public.event_registrations(prospect_id) where prospect_id is not null;
create index registrations_sponsor_idx on public.event_registrations(sponsor_member_id) where sponsor_member_id is not null;
create index registrations_registered_at_idx on public.event_registrations(registered_at desc);

create index attendance_event_checked_idx on public.attendance_records(event_id, checked_in_at desc);
create index attendance_member_idx on public.attendance_records(member_id) where member_id is not null;
create index attendance_prospect_idx on public.attendance_records(prospect_id) where prospect_id is not null;
create index attendance_checked_by_idx on public.attendance_records(checked_in_by_profile_id);

create index genealogy_descendant_depth_idx on public.genealogy(descendant_member_id, depth);
create index genealogy_ancestor_depth_idx on public.genealogy(ancestor_member_id, depth);

create index commissions_earner_period_idx on public.commissions(earner_member_id, period_start, period_end);
create index commissions_status_idx on public.commissions(status);
create index commissions_referral_idx on public.commissions(referral_id) where referral_id is not null;

create index notifications_recipient_profile_idx on public.notifications(recipient_profile_id, status, created_at desc);
create index notifications_recipient_member_idx on public.notifications(recipient_member_id, status, created_at desc);
create index notifications_recipient_prospect_idx on public.notifications(recipient_prospect_id, status, created_at desc);
create index notifications_scheduled_idx on public.notifications(scheduled_for) where status = 'queued';
create index notifications_event_idx on public.notifications(event_id) where event_id is not null;

-- RLS helper functions
create or replace function public.current_profile_id()
returns uuid
language sql
stable
as $$
  select auth.uid()
$$;

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

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.ranks enable row level security;
alter table public.members enable row level security;
alter table public.prospects enable row level security;
alter table public.events enable row level security;
alter table public.event_speakers enable row level security;
alter table public.event_registrations enable row level security;
alter table public.attendance_records enable row level security;
alter table public.referrals enable row level security;
alter table public.genealogy enable row level security;
alter table public.commissions enable row level security;
alter table public.notifications enable row level security;

-- profiles
create policy "profiles_select_own_or_admin"
on public.profiles for select
using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid() and is_admin = false);

create policy "profiles_admin_all"
on public.profiles for all
using (public.is_admin())
with check (public.is_admin());

-- ranks
create policy "ranks_read_active"
on public.ranks for select
using (active = true or public.is_admin());

create policy "ranks_admin_all"
on public.ranks for all
using (public.is_admin())
with check (public.is_admin());

-- members
create policy "members_select_self_upline_downline_or_admin"
on public.members for select
using (
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

create policy "members_update_self_limited"
on public.members for update
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy "members_admin_all"
on public.members for all
using (public.is_admin())
with check (public.is_admin());

-- prospects
create policy "prospects_insert_public"
on public.prospects for insert
with check (
  consent_privacy = true
  and profile_id is null
  and converted_member_id is null
  and converted_at is null
  and stage in ('new', 'registered')
);

create policy "prospects_select_owner_sponsor_or_admin"
on public.prospects for select
using (
  profile_id = auth.uid()
  or sponsor_member_id = public.current_member_id()
  or public.is_admin()
);

create policy "prospects_update_sponsor_or_admin"
on public.prospects for update
using (sponsor_member_id = public.current_member_id() or public.is_admin())
with check (sponsor_member_id = public.current_member_id() or public.is_admin());

-- events
create policy "events_select_published_public"
on public.events for select
using (
  (status = 'published' and visibility = 'public')
  or public.can_manage_event(id)
);

create policy "events_select_private_for_authenticated"
on public.events for select
using (
  auth.uid() is not null and status = 'published' and visibility = 'private'
);

create policy "events_insert_authenticated"
on public.events for insert
with check (public.can_write_event_row(created_by_profile_id, host_member_id));

create policy "events_manage_owner_or_admin"
on public.events for update
using (public.can_manage_event(id))
with check (public.can_write_event_row(created_by_profile_id, host_member_id));

create policy "events_delete_admin"
on public.events for delete
using (public.is_admin());

-- event_speakers
create policy "event_speakers_select_visible_events"
on public.event_speakers for select
using (
  exists (
    select 1 from public.events e
    where e.id = event_speakers.event_id
      and ((e.status = 'published' and e.visibility = 'public') or public.can_manage_event(e.id))
  )
);

create policy "event_speakers_manage_event"
on public.event_speakers for all
using (public.can_manage_event(event_id))
with check (public.can_manage_event(event_id));

-- referrals
create policy "referrals_insert_member"
on public.referrals for insert
with check (referrer_member_id = public.current_member_id() or public.is_admin());

create policy "referrals_select_owner_referred_or_admin"
on public.referrals for select
using (
  referrer_member_id = public.current_member_id()
  or referred_profile_id = auth.uid()
  or public.is_admin()
);

create policy "referrals_update_owner_or_admin"
on public.referrals for update
using (referrer_member_id = public.current_member_id() or public.is_admin())
with check (referrer_member_id = public.current_member_id() or public.is_admin());

-- event_registrations
create policy "registrations_insert_public_or_member"
on public.event_registrations for insert
with check (
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
  and (
    (
      auth.uid() is null
      and registration_kind = 'prospect'
      and profile_id is null
      and member_id is null
    )
    or (
      auth.uid() is not null
      and (
        profile_id = auth.uid()
        or member_id = public.current_member_id()
        or registration_kind = 'prospect'
      )
    )
  )
);

create policy "registrations_select_self_sponsor_event_manager_or_admin"
on public.event_registrations for select
using (
  profile_id = auth.uid()
  or member_id = public.current_member_id()
  or sponsor_member_id = public.current_member_id()
  or public.can_manage_event(event_id)
  or public.is_admin()
);

create policy "registrations_update_self_cancel"
on public.event_registrations for update
using (profile_id = auth.uid() or member_id = public.current_member_id())
with check (profile_id = auth.uid() or member_id = public.current_member_id());

create policy "registrations_manage_event"
on public.event_registrations for update
using (public.can_manage_event(event_id))
with check (public.can_manage_event(event_id));

-- attendance_records
create policy "attendance_select_self_sponsor_event_manager_or_admin"
on public.attendance_records for select
using (
  member_id = public.current_member_id()
  or exists (
    select 1 from public.prospects p
    where p.id = attendance_records.prospect_id
      and p.sponsor_member_id = public.current_member_id()
  )
  or public.can_manage_event(event_id)
  or public.is_admin()
);

create policy "attendance_insert_event_manager"
on public.attendance_records for insert
with check (public.can_manage_event(event_id));

create policy "attendance_update_event_manager"
on public.attendance_records for update
using (public.can_manage_event(event_id))
with check (public.can_manage_event(event_id));

-- genealogy
create policy "genealogy_select_self_network_or_admin"
on public.genealogy for select
using (
  ancestor_member_id = public.current_member_id()
  or descendant_member_id = public.current_member_id()
  or public.is_admin()
);

create policy "genealogy_admin_all"
on public.genealogy for all
using (public.is_admin())
with check (public.is_admin());

-- commissions
create policy "commissions_select_earner_or_admin"
on public.commissions for select
using (earner_member_id = public.current_member_id() or public.is_admin());

create policy "commissions_admin_all"
on public.commissions for all
using (public.is_admin())
with check (public.is_admin());

-- notifications
create policy "notifications_select_recipient_or_admin"
on public.notifications for select
using (
  recipient_profile_id = auth.uid()
  or recipient_member_id = public.current_member_id()
  or exists (
    select 1 from public.prospects p
    where p.id = notifications.recipient_prospect_id
      and p.profile_id = auth.uid()
  )
  or public.is_admin()
);

create policy "notifications_update_read_by_recipient"
on public.notifications for update
using (
  recipient_profile_id = auth.uid()
  or recipient_member_id = public.current_member_id()
)
with check (
  recipient_profile_id = auth.uid()
  or recipient_member_id = public.current_member_id()
);

create policy "notifications_admin_all"
on public.notifications for all
using (public.is_admin())
with check (public.is_admin());

-- Seed baseline ranks
insert into public.ranks (code, name, level, description, requirements, commission_rate_bps)
values
  ('PROSPECT', 'Prospect', 0, 'Pre-member or guest state.', '{}'::jsonb, 0),
  ('SL', 'Squad Leader', 10, 'Active builder with direct invite activity.', '{"direct_members": 1}'::jsonb, 500),
  ('PL', 'Platoon Leader', 20, 'Leader with active downline depth.', '{"direct_members": 5, "active_downline": 20}'::jsonb, 700)
on conflict (code) do nothing;
