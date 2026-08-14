-- =============================================================
-- Close registration on events that have already finished.
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- An event is finished once its end time has passed — or its start
-- time, when it is open-ended (ends_at is null). Same rule as the
-- admin "Finished" tab and the member "Past" tab.
--
-- This file only patches the RLS policy. The two SECURITY DEFINER
-- RPCs that actually handle registration bypass RLS, so they carry
-- the same guard in their own files — re-run these as well:
--   - member self-RSVP:      member_events_experience.sql
--                            (register_member_for_event)
--   - public/prospect form:  private_event_link_access.sql
--                            (register_prospect_for_event — this is
--                            the current definition; it supersedes
--                            the copies in prospect_registration.sql
--                            and private_event_invite.sql)
--
-- Note: get_invite_event is deliberately NOT guarded, so the invite
-- page and QR links still resolve for past events. Registration is
-- refused at submit time instead of the page 404ing.
-- =============================================================

drop policy if exists "registrations_insert_public_or_member" on public.event_registrations;

create policy "registrations_insert_public_or_member"
on public.event_registrations for insert
with check (
  exists (
    select 1 from public.events e
    where e.id = event_id
      and e.status = 'published'
      and e.visibility = 'public'
      and coalesce(e.ends_at, e.starts_at) >= now()
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
