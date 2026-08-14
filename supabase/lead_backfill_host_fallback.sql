-- GEMA Leads: backfill existing attendees + sponsorless-lead attribution
-- Run after lead_referrals.sql. Safe to re-run.
--
-- 1. Everyone who checked in before lead_referrals.sql was applied is still
--    sitting at stage 'new'/'registered', because the old record_attendance
--    only touched event_registrations. Advance this year's attendees once.
-- 2. A lead who registered without a ref code has no sponsor_member_id, so
--    credit from their referral link previously resolved to nobody. Fall back
--    to the host of the event the new prospect is registering for.
--
-- Nothing to run afterwards: a lead has no account. Step 1 is all it takes for
-- them to claim a referral link from /passes.

-- =============================================================
-- 1. Backfill: attended at least one event this year => 'attended'.
--    Scoped to this year's check-ins so the follow-up provisioning run
--    doesn't email people who last attended years ago. Move the cutoff
--    back to reach further into the history — it's an explicit Manila
--    boundary, not date_trunc('year', now()), so re-running later in the
--    year picks up the same window rather than a shifting one.
-- =============================================================

update public.prospects p
set stage = 'attended'
where p.stage in ('new', 'registered')
  and exists (
    select 1 from public.attendance_records a
    where a.prospect_id = p.id
      and a.checked_in_at >= timestamptz '2026-01-01 00:00+08'
  );

-- =============================================================
-- 2. register_prospect_for_event: sponsorless lead => event host.
--    Unchanged from lead_referrals.sql apart from the fallback below.
-- =============================================================

create or replace function public.register_prospect_for_event(
  p_event_id uuid,
  p_full_name text,
  p_phone text,
  p_email text,
  p_city text,
  p_consent_privacy boolean,
  p_consent_marketing boolean,
  p_prospect_id uuid,
  p_registration_id uuid,
  p_pass_code text,
  p_qr_payload text,
  p_ref_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_referral public.referrals;
  v_referral_id uuid := null;
  v_sponsor uuid := null;
  -- ponytail: reuses 'member_referral' for lead-driven signups too — no
  -- distinct enum value, add one if the source label needs to differ.
  v_source public.registration_source := 'public_invite';
  v_count integer;
begin
  if not p_consent_privacy then
    raise exception 'Privacy consent is required' using errcode = 'check_violation';
  end if;

  select * into v_event from public.events where id = p_event_id;
  if not found then
    raise exception 'Event not found' using errcode = 'no_data_found';
  end if;

  if p_ref_code is not null and length(trim(p_ref_code)) > 0 then
    select * into v_referral
    from public.referrals
    where ref_code = p_ref_code
      and status in ('active', 'claimed')
      and (expires_at is null or expires_at > now());
    if found then
      v_referral_id := v_referral.id;
      v_source := 'member_referral';
      if v_referral.referrer_member_id is not null then
        v_sponsor := v_referral.referrer_member_id;
      else
        -- Lead-owned link: credit rolls up to the lead's own sponsor.
        select sponsor_member_id into v_sponsor
        from public.prospects
        where id = v_referral.referrer_prospect_id;

        -- A lead who registered without a ref code has no sponsor of their
        -- own. Credit the host of the event being registered for, so the
        -- signup isn't orphaned. Still null for events with no host member.
        if v_sponsor is null then
          v_sponsor := v_event.host_member_id;
        end if;
      end if;
    end if;
  end if;

  if v_event.status <> 'published' then
    raise exception 'Event is not open for registration' using errcode = 'check_violation';
  end if;

  if v_event.capacity is not null then
    select count(*) into v_count
    from public.event_registrations
    where event_id = p_event_id and status <> 'cancelled';
    if v_count >= v_event.capacity then
      raise exception 'Event is at full capacity' using errcode = 'check_violation';
    end if;
  end if;

  insert into public.prospects (
    id, sponsor_member_id, full_name, phone, email, stage, source,
    consent_privacy, consent_marketing, metadata
  )
  values (
    p_prospect_id, v_sponsor, p_full_name, nullif(p_phone, ''), nullif(p_email, ''),
    'registered', v_source::text, p_consent_privacy, p_consent_marketing,
    jsonb_build_object('city', p_city)
  );

  insert into public.event_registrations (
    id, event_id, prospect_id, referral_id, sponsor_member_id,
    registration_kind, status, source, pass_code, qr_payload,
    attendee_name, attendee_phone, attendee_email,
    consent_privacy, consent_marketing, metadata
  )
  values (
    p_registration_id, p_event_id, p_prospect_id, v_referral_id, v_sponsor,
    'prospect', 'registered', v_source, p_pass_code, p_qr_payload,
    p_full_name, nullif(p_phone, ''), nullif(p_email, ''),
    p_consent_privacy, p_consent_marketing, jsonb_build_object('city', p_city)
  );

  if v_referral_id is not null then
    update public.referrals
    set status = case when status = 'active' then 'claimed' else status end,
        prospect_id = coalesce(prospect_id, p_prospect_id),
        claimed_at = coalesce(claimed_at, now())
    where id = v_referral_id;
  end if;

  return jsonb_build_object(
    'registration_id', p_registration_id,
    'prospect_id', p_prospect_id,
    'pass_code', p_pass_code
  );
end;
$$;

revoke all on function public.register_prospect_for_event(
  uuid, text, text, text, text, boolean, boolean, uuid, uuid, text, text, text
) from public;
grant execute on function public.register_prospect_for_event(
  uuid, text, text, text, text, boolean, boolean, uuid, uuid, text, text, text
) to anon, authenticated;

-- =============================================================
-- 3. Drop the lead RLS policies from lead_referrals.sql.
--    They matched on auth.uid() against prospects.profile_id, which only
--    meant something while leads had accounts. Leads now claim their link
--    from /passes with no session at all, so these can never match.
-- =============================================================

drop policy if exists "referrals_insert_lead" on public.referrals;
drop policy if exists "referrals_select_lead_owner" on public.referrals;
