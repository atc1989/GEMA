-- GEMA Leads: referral link for attended-but-unconverted prospects
-- Run after private_event_link_access.sql / qr_attendance.sql. Safe to re-run.
--
-- A prospect who has attended at least one event ("lead") gets a real login
-- (provisioned in the app, not here — see ensureLeadAccount in
-- src/lib/actions/lead-accounts.ts) and can own a referral link, without a
-- `members` row or any of the rest of the member workspace. This migration:
--   1. Makes record_attendance() actually advance prospects.stage to
--      'attended' (previously it only touched event_registrations.status).
--   2. Lets a `referrals` row be owned by a prospect instead of a member.
--   3. Teaches referral resolution + registration to credit either owner
--      type, rolling a lead's referral credit up to the lead's own sponsor.

-- =============================================================
-- 1. record_attendance: also advance the prospect's funnel stage.
-- =============================================================

create or replace function public.record_attendance(
  p_event_id uuid,
  p_registration_id uuid,
  p_device_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_reg public.event_registrations;
  v_att public.attendance_records;
begin
  if not public.can_manage_event(p_event_id) then
    raise exception 'Not authorized to record attendance for this event'
      using errcode = '42501';
  end if;

  select * into v_event from public.events where id = p_event_id;
  if not found then
    raise exception 'Event not found' using errcode = 'no_data_found';
  end if;
  if v_event.status = 'cancelled' then
    raise exception 'This event has been cancelled' using errcode = 'check_violation';
  end if;
  if v_event.ends_at is not null and v_event.ends_at < (now() - interval '6 hours') then
    raise exception 'This event has already ended' using errcode = 'check_violation';
  end if;

  select * into v_reg
  from public.event_registrations
  where id = p_registration_id and event_id = p_event_id;
  if not found then
    raise exception 'Registration not found for this event' using errcode = 'no_data_found';
  end if;
  if v_reg.status = 'cancelled' then
    raise exception 'This registration was cancelled' using errcode = 'check_violation';
  end if;

  select * into v_att
  from public.attendance_records
  where registration_id = p_registration_id;
  if found then
    return jsonb_build_object(
      'status', 'already',
      'attendance_id', v_att.id,
      'checked_in_at', v_att.checked_in_at
    );
  end if;

  begin
    insert into public.attendance_records (
      event_id, registration_id, member_id, prospect_id,
      checked_in_by_profile_id, status, checked_in_at, qr_payload, device_id
    )
    values (
      p_event_id, p_registration_id, v_reg.member_id, v_reg.prospect_id,
      auth.uid(), 'checked_in', now(), v_reg.qr_payload, p_device_id
    )
    returning * into v_att;
  exception when unique_violation then
    select * into v_att
    from public.attendance_records
    where registration_id = p_registration_id;
    return jsonb_build_object(
      'status', 'already',
      'attendance_id', v_att.id,
      'checked_in_at', v_att.checked_in_at
    );
  end;

  update public.event_registrations
  set status = 'attended', attended_at = now()
  where id = p_registration_id and status <> 'attended';

  -- Advance the prospect to "lead" (attended) — forward-only, never
  -- overwrites followup/converted/expired.
  if v_reg.prospect_id is not null then
    update public.prospects
    set stage = 'attended'
    where id = v_reg.prospect_id and stage in ('new', 'registered');
  end if;

  return jsonb_build_object(
    'status', 'checked_in',
    'attendance_id', v_att.id,
    'checked_in_at', v_att.checked_in_at
  );
end;
$$;

revoke all on function public.record_attendance(uuid, uuid, text) from public;
grant execute on function public.record_attendance(uuid, uuid, text) to authenticated;

-- =============================================================
-- 2. referrals: allow a prospect (lead) as the referrer, not just a member.
-- =============================================================

alter table public.referrals alter column referrer_member_id drop not null;

alter table public.referrals
  add column if not exists referrer_prospect_id uuid references public.prospects(id) on delete cascade;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'referrals_referrer_owner_check'
  ) then
    alter table public.referrals
      add constraint referrals_referrer_owner_check
      check (num_nonnulls(referrer_member_id, referrer_prospect_id) = 1);
  end if;
end $$;

create index if not exists referrals_referrer_prospect_idx
  on public.referrals(referrer_prospect_id) where referrer_prospect_id is not null;

-- A lead manages only their own referral row, same shape as the member
-- policies (referrals_insert_member / _select_owner_referred_or_admin /
-- _update_owner_or_admin) just scoped through their own prospects row
-- instead of current_member_id().
drop policy if exists "referrals_insert_lead" on public.referrals;
create policy "referrals_insert_lead"
on public.referrals for insert
with check (
  referrer_prospect_id in (
    select id from public.prospects
    where profile_id = auth.uid() and stage in ('attended', 'followup')
  )
);

drop policy if exists "referrals_select_lead_owner" on public.referrals;
create policy "referrals_select_lead_owner"
on public.referrals for select
using (
  referrer_prospect_id in (
    select id from public.prospects where profile_id = auth.uid()
  )
);

-- =============================================================
-- 3. Referral resolution + registration: handle either owner type.
-- =============================================================

create or replace function public.resolve_invite_referral(p_ref_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if p_ref_code is null or length(trim(p_ref_code)) = 0 then
    return jsonb_build_object('valid', false, 'inviter_name', null);
  end if;

  select coalesce(p.full_name, m.username, lead.full_name)
  into v_name
  from public.referrals r
  left join public.members m on m.id = r.referrer_member_id
  left join public.profiles p on p.id = m.profile_id
  left join public.prospects lead on lead.id = r.referrer_prospect_id
  where r.ref_code = p_ref_code
    and r.status in ('active', 'claimed')
    and (r.expires_at is null or r.expires_at > now())
  limit 1;

  if v_name is null then
    return jsonb_build_object('valid', false, 'inviter_name', null);
  end if;

  return jsonb_build_object('valid', true, 'inviter_name', v_name);
end;
$$;

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
