-- RLS gap patch.
-- The existing-project migration (gema_existing_project_migration.sql) shipped
-- only a subset of schema.sql's RLS policies — several write (UPDATE) policies
-- were left out, so members could read rows but not update them. These are the
-- missing policies needed for the member workflow. Safe + idempotent (drop/create).
-- Run once in the Supabase SQL editor.

-- Members can mark sponsored prospects (stage / follow-up). (Fixes "Prospect not
-- found or already converted." on Mark as follow-up.)
drop policy if exists "prospects_update_sponsor_or_admin" on public.prospects;
create policy "prospects_update_sponsor_or_admin"
on public.prospects for update
using (sponsor_member_id = public.current_member_id() or public.is_admin())
with check (sponsor_member_id = public.current_member_id() or public.is_admin());

-- Members can update their own member row (No-Zero streak caching, etc.).
drop policy if exists "members_update_self_limited" on public.members;
create policy "members_update_self_limited"
on public.members for update
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

-- Attendees can cancel their own registration.
drop policy if exists "registrations_update_self_cancel" on public.event_registrations;
create policy "registrations_update_self_cancel"
on public.event_registrations for update
using (profile_id = auth.uid() or member_id = public.current_member_id())
with check (profile_id = auth.uid() or member_id = public.current_member_id());

-- Event hosts/admins can manage registrations for their events.
drop policy if exists "registrations_manage_event" on public.event_registrations;
create policy "registrations_manage_event"
on public.event_registrations for update
using (public.can_manage_event(event_id))
with check (public.can_manage_event(event_id));

-- Event hosts/admins can update attendance records (e.g. void a check-in).
drop policy if exists "attendance_update_event_manager" on public.attendance_records;
create policy "attendance_update_event_manager"
on public.attendance_records for update
using (public.can_manage_event(event_id))
with check (public.can_manage_event(event_id));
