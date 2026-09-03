-- Change 3 — what the migration must hold on the real Staging shape of
-- public.profiles (id, email, first_name, last_name, full_name, created_at,
-- updated_at, phone, role, is_admin, avatar_url, last_seen_at,
-- can_publish_events).
--
-- The headline check is section 2: without the column GRANTs, an ordinary
-- member can make themselves an admin with one UPDATE.

begin;

insert into auth.users (id, email) values
  ('bbbb1111-0000-0000-0000-000000000001', 'chg3.member@example.invalid');
insert into public.profiles (id, email, full_name, role)
  values ('bbbb1111-0000-0000-0000-000000000001', 'chg3.member@example.invalid',
          'Ordinary Member', 'member');

-- 1. Identity columns exist and default sanely.
do $$
begin
  if not exists (
    select 1 from public.profiles
     where id = 'bbbb1111-0000-0000-0000-000000000001' and account_status = 'active'
  ) then raise exception 'account_status missing or not defaulted'; end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='profiles'
       and column_name in ('locale','timezone')
     having count(*) = 2
  ) then raise exception 'locale/timezone not added'; end if;

  begin
    update public.profiles set account_status = 'banana'
     where id = 'bbbb1111-0000-0000-0000-000000000001';
    raise exception 'account_status accepted an invalid value';
  exception when check_violation then null;
  end;
end $$;

-- 2. No member holds an UPDATE grant on a privileged column.
do $$
declare leaked text;
begin
  select string_agg(column_name, ', ' order by column_name) into leaked
    from information_schema.column_privileges
   where table_schema='public' and table_name='profiles'
     and grantee in ('authenticated','anon') and privilege_type='UPDATE'
     and column_name in ('role','is_admin','can_publish_events',
                         'account_status','id','email','created_at');
  if leaked is not null then
    raise exception 'members can update privileged columns: %', leaked;
  end if;

  if not exists (
    select 1 from information_schema.column_privileges
     where table_schema='public' and table_name='profiles'
       and grantee='authenticated' and privilege_type='UPDATE'
       and column_name='full_name'
  ) then raise exception 'members cannot edit their own full_name'; end if;
end $$;

-- 3. The escalation itself, attempted as the member.
do $$
begin
  set local role authenticated;
  set local request.jwt.claim.sub = 'bbbb1111-0000-0000-0000-000000000001';
  begin
    update public.profiles set role = 'admin'
     where id = 'bbbb1111-0000-0000-0000-000000000001';
    raise exception 'a member escalated themselves to admin via role';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 4. Status changes are admin-only.
do $$
begin
  set local role authenticated;
  set local request.jwt.claim.sub = 'bbbb1111-0000-0000-0000-000000000001';
  begin
    perform public.set_account_status(
      'bbbb1111-0000-0000-0000-000000000001', 'suspended');
    raise exception 'a non-admin changed an account status';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
