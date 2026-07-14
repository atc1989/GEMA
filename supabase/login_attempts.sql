-- =============================================================
-- Failed-login attempt log + throttle support
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- Only FAILED logins are recorded (wrong password / unknown user).
-- The app blocks an identifier after 5 failures in 15 minutes.
-- =============================================================

create table if not exists public.login_attempts (
  id bigint generated always as identity primary key,
  username text not null,
  client_ip text,
  created_at timestamptz not null default now()
);

-- Serves the "failures in the last 15 minutes" throttle query.
create index if not exists idx_login_attempts_username_time
  on public.login_attempts (username, created_at desc);

-- No policies on purpose: only the service-role key (server) touches this.
alter table public.login_attempts enable row level security;

-- Optional housekeeping, run whenever the table feels big:
-- delete from public.login_attempts where created_at < now() - interval '30 days';
