-- =============================================================
-- Attendee sponsor/referral info for the attendance dashboards
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- Hosts can only read their own downline + own referrals under RLS,
-- so a plain join would blank out sponsors from other lines. This
-- SECURITY DEFINER lookup returns inviter name + ref code for every
-- registration of an event, but only to users who can manage that
-- event (same can_manage_event rule as attendance writes).
-- =============================================================

create or replace function public.get_event_attendee_sponsors(p_event_id uuid)
returns table (
  registration_id uuid,
  ref_code text,
  sponsor_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    er.id,
    r.ref_code,
    coalesce(p.full_name, m.username)
  from public.event_registrations er
  left join public.referrals r on r.id = er.referral_id
  left join public.members m on m.id = er.sponsor_member_id
  left join public.profiles p on p.id = m.profile_id
  where er.event_id = p_event_id
    and public.can_manage_event(p_event_id);
$$;

revoke all on function public.get_event_attendee_sponsors(uuid) from public;
grant execute on function public.get_event_attendee_sponsors(uuid) to authenticated;
