-- GEMA Referrals RLS fix
-- gema_existing_project_migration.sql enables RLS on public.referrals but only
-- defines a SELECT policy, so member-facing inserts (createReferralLink) are
-- denied by default. This adds the missing INSERT + UPDATE policies, matching
-- the intent in schema.sql: a member manages their own referrals; admins manage
-- all. (SECURITY DEFINER routines bypass RLS and are unaffected.)
--
-- Run once against the GEMA Supabase project. Safe to re-run.

drop policy if exists "referrals_insert_member" on public.referrals;
create policy "referrals_insert_member"
on public.referrals for insert
with check (
  referrer_member_id = public.current_member_id()
  or public.is_admin()
);

drop policy if exists "referrals_update_owner_or_admin" on public.referrals;
create policy "referrals_update_owner_or_admin"
on public.referrals for update
using (
  referrer_member_id = public.current_member_id()
  or public.is_admin()
)
with check (
  referrer_member_id = public.current_member_id()
  or public.is_admin()
);
