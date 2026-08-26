-- =============================================================
-- Admins can check in after an event has ended.
-- Run after lead_referrals.sql. Safe to re-run.
--
-- Hosts (non-admin event managers) stay blocked 6 hours after
-- ends_at — same window as before. Open-ended events (ends_at
-- is null) never hit this gate. Cancelled events and cancelled
-- registrations are still rejected for everyone.
--
-- Recreates record_attendance from lead_referrals.sql, including
-- the prospect-stage advance to 'attended'. Do not apply an older
-- copy of this function (qr_attendance.sql) afterwards.
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
  -- Hosts cannot check in more than 6h after ends_at. Admins can,
  -- so late corrections on finished events stay possible.
  if not public.is_admin()
     and v_event.ends_at is not null
     and v_event.ends_at < (now() - interval '6 hours') then
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
