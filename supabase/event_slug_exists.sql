-- Slug uniqueness check that sees every event, bypassing RLS.
--
-- Why: RLS on public.events hides drafts and other users' events, so a plain
-- select from the app reports "no collision" for slugs that do exist. The
-- insert then fails with:
--   duplicate key value violates unique constraint "events_slug_key"
-- Run this in the Supabase SQL editor (same as the other feature .sql files).

create or replace function public.event_slug_exists(
  p_slug text,
  p_ignore_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.events
    where slug = p_slug
      and (p_ignore_id is null or id <> p_ignore_id)
  );
$$;

revoke all on function public.event_slug_exists(text, uuid) from public, anon;
grant execute on function public.event_slug_exists(text, uuid) to authenticated;
