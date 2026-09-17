-- Standby list: default 20 a day, and never null while standby is on.
--
-- Apply to STAGING (fxdsnacuonfvutdquogb) first, then PRODUCTION
-- (rvwseybgimmewuoccecu). Additive and re-runnable; nothing the running app
-- calls changes shape, so it is safe with guests mid-booking.
--
-- Run after event_standby.sql.
--
-- Eighty was a round number picked before the arithmetic. The only thing that
-- frees a seat is a no-show, so a day of 21 seats turns over perhaps four of
-- them: a queue of eighty is four people seen and seventy-six who travelled for
-- nothing. Twenty is still a long shot at the back of the line, but it is a
-- queue rather than a crowd, and the people beyond it are turned away on the
-- website where it costs them nothing.

-- New events get 20 unless the host says otherwise.
alter table gema.events
  alter column standby_limit set default 20;

-- Any event already taking standby with no limit set was silently running on
-- the RPC's own coalesce. Give it a real number.
update gema.events
set standby_limit = 20
where standby_enabled and standby_limit is null;

-- And make that state impossible from here on. The app always writes a limit
-- when standby is switched on; this stops a hand-run
-- `update events set standby_enabled = true` from leaving the landing page and
-- the registration RPC disagreeing about how long the queue is.
alter table gema.events drop constraint if exists events_standby_limit_present;
alter table gema.events
  add constraint events_standby_limit_present
  check (not standby_enabled or standby_limit is not null);
