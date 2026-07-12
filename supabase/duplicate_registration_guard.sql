-- =============================================================
-- Duplicate-registration guard + one-time data cleanup
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- Order matters: the cleanup must run before the unique index,
-- otherwise index creation fails on existing duplicates.
-- =============================================================

-- 1) Cancel duplicate registrations (same event + same name + same email).
--    Keeps the checked-in row if one exists, else the earliest registration.
with ranked as (
  select
    er.id,
    row_number() over (
      partition by er.event_id, lower(er.attendee_name), lower(er.attendee_email)
      order by (ar.registration_id is not null) desc, er.registered_at asc
    ) as rn
  from public.event_registrations er
  left join public.attendance_records ar on ar.registration_id = er.id
  where er.status <> 'cancelled'
    and er.attendee_email is not null
)
update public.event_registrations
set status = 'cancelled'
where id in (select id from ranked where rn > 1);

-- 2) Block future duplicates at the DB level. Partial: cancelled rows don't
--    count, so someone can re-register after a cancellation. Same email with
--    a different name is still allowed (group registrations by one contact).
create unique index if not exists uniq_event_registration_attendee
  on public.event_registrations (event_id, lower(attendee_name), lower(attendee_email))
  where status <> 'cancelled' and attendee_email is not null;

-- 3) One-off: normalize existing PH phone numbers to +639… format
--    (09xxxxxxxxx and bare 9xxxxxxxxx). New registrations are normalized
--    by the app before insert.
update public.event_registrations
set attendee_phone = '+63' || right(regexp_replace(attendee_phone, '\D', '', 'g'), 10)
where regexp_replace(attendee_phone, '\D', '', 'g') ~ '^0?9\d{9}$'
  and attendee_phone not like '+63%';

update public.prospects
set phone = '+63' || right(regexp_replace(phone, '\D', '', 'g'), 10)
where regexp_replace(phone, '\D', '', 'g') ~ '^0?9\d{9}$'
  and phone not like '+63%';

-- 4) One-off: fix the known @tahoo.com typo.
update public.event_registrations
set attendee_email = replace(attendee_email, '@tahoo.com', '@yahoo.com')
where attendee_email like '%@tahoo.com';

update public.prospects
set email = replace(email, '@tahoo.com', '@yahoo.com')
where email like '%@tahoo.com';
