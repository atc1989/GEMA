-- GEMA QR Attendance Check-In
-- Adds an atomic, permission-checked check-in routine on top of the existing
-- event_registrations / attendance_records tables and RLS from schema.sql.
--
-- Run this once against the GEMA Supabase project (after schema.sql / the
-- existing-project migration). Safe to re-run (create or replace + guards).

-- Speeds up "already checked in" lookups and the dashboard tables.
create index if not exists attendance_registration_idx
  on public.attendance_records(registration_id);

/*
 * record_attendance: validates and records a single check-in in one
 * transaction. Runs as SECURITY DEFINER so it can write attendance + flip the
 * registration status together, but it re-checks authorization with
 * can_manage_event() against the *calling* user (auth.uid()), so it never
 * bypasses the event-manager rule.
 *
 * Returns jsonb:
 *   { status: 'checked_in' | 'already', attendance_id, checked_in_at }
 * Raises on: unauthorized, missing/closed event, expired event, missing or
 * cancelled registration.
 */
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
  -- Expired-event protection: block check-ins more than 6h after the event end.
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

  -- Fast path duplicate check.
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
    -- Concurrent scan won the race; treat as already checked in.
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

  return jsonb_build_object(
    'status', 'checked_in',
    'attendance_id', v_att.id,
    'checked_in_at', v_att.checked_in_at
  );
end;
$$;

revoke all on function public.record_attendance(uuid, uuid, text) from public;
grant execute on function public.record_attendance(uuid, uuid, text) to authenticated;
