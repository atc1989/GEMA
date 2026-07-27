-- Lets admins pin an event so it stays at the top of the admin events list,
-- regardless of its start date. pinned_at also orders multiple pinned events
-- by most-recently-pinned first.

alter table public.events
  add column pinned_at timestamptz;

create index events_pinned_idx on public.events(pinned_at desc);
