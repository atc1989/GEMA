-- Event cards showed "by Unknown" because:
-- 1. gema.profiles SELECT RLS only allowed a user to see their own row, so the
--    admin events embed of created_by profiles came back null.
-- 2. Almost every imported profile has full_name filled and first/last empty;
--    the UI only concatenated first + last.

drop policy if exists "Users can view their own profile" on gema.profiles;
drop policy if exists profiles_select_own_or_admin on gema.profiles;
create policy profiles_select_own_or_admin on gema.profiles
for select
using (id = auth.uid() or gema.is_admin());

drop policy if exists profiles_admin_all on gema.profiles;
create policy profiles_admin_all on gema.profiles
for all
using (gema.is_admin())
with check (gema.is_admin());
