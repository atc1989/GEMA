-- Lets event managers attach a private note to a registration (e.g. "bringing a plus-one",
-- "VIP guest"). Visible to admins/event managers only — not exposed to the attendee.
-- Existing RLS policy `registrations_manage_event` already covers updates by anyone who
-- can_manage_event(event_id), so no new policy is needed.

alter table public.event_registrations
  add column if not exists admin_note text;
