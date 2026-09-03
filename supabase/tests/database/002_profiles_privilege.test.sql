-- Change 3 — what the migration must hold on public.profiles as it really is:
-- the Lifestyle card table plus a `role` column.
--
-- The headline check is section 3: without the column GRANTs, a member can
-- PATCH their own role and points.

begin;

insert into auth.users (id, email) values
  ('bbbb1111-0000-0000-0000-000000000001', 'chg3.card@example.invalid'),
  ('bbbb1111-0000-0000-0000-000000000002', 'chg3.person@example.invalid');

insert into public.profiles (id, name, mobile, email, card_no, points, banked)
  values ('bbbb1111-0000-0000-0000-000000000001', 'Card Holder', '09995015001',
          'chg3.card@example.invalid', 'GG-T001', 40, 10);

do $$
begin
  -- 1. Backfill and both sync directions.
  if not exists (select 1 from public.profiles
                  where id = 'bbbb1111-0000-0000-0000-000000000001'
                    and full_name = 'Card Holder' and phone = '09995015001')
  then raise exception 'backfill did not fill full_name and phone'; end if;

  update public.profiles set full_name = 'Renamed A'
   where id = 'bbbb1111-0000-0000-0000-000000000001';
  if (select name from public.profiles
       where id = 'bbbb1111-0000-0000-0000-000000000001') <> 'Renamed A'
  then raise exception 'full_name did not propagate to name'; end if;

  update public.profiles set name = 'Renamed B'
   where id = 'bbbb1111-0000-0000-0000-000000000001';
  if (select full_name from public.profiles
       where id = 'bbbb1111-0000-0000-0000-000000000001') <> 'Renamed B'
  then raise exception 'name did not propagate to full_name'; end if;

  -- 2. A person can exist without a Lifestyle card. 00 - Locks requires it.
  insert into public.profiles (id, full_name, email, account_status)
    values ('bbbb1111-0000-0000-0000-000000000002', 'Person Only',
            'chg3.person@example.invalid', 'active');
  if exists (select 1 from public.profiles
              where id = 'bbbb1111-0000-0000-0000-000000000002'
                and card_no is not null)
  then raise exception 'a cardless person was given a card'; end if;

  begin
    update public.profiles set account_status = 'banana'
     where id = 'bbbb1111-0000-0000-0000-000000000001';
    raise exception 'account_status accepted an invalid value';
  exception when check_violation then null;
  end;
end $$;

-- 3. No member holds an UPDATE grant on a privileged column.
do $$
declare leaked text;
begin
  select string_agg(column_name, ', ' order by column_name) into leaked
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'profiles'
     and grantee in ('authenticated','anon') and privilege_type = 'UPDATE'
     and column_name in ('role','account_status','points','pending','banked',
                         'phase','claimed','card_no','sponsor','team',
                         'days_left','id','created_at');
  if leaked is not null then
    raise exception 'members can update privileged columns: %', leaked;
  end if;

  if not exists (select 1 from information_schema.column_privileges
                  where table_schema='public' and table_name='profiles'
                    and grantee='authenticated' and privilege_type='UPDATE'
                    and column_name='full_name')
  then raise exception 'members cannot edit their own full_name'; end if;
end $$;

-- 4. The writes themselves, attempted as the member.
do $$
begin
  set local role authenticated;
  set local request.jwt.claim.sub = 'bbbb1111-0000-0000-0000-000000000001';

  begin
    update public.profiles set role = 'admin'
     where id = 'bbbb1111-0000-0000-0000-000000000001';
    raise exception 'a member set their own role';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.profiles set points = 999999
     where id = 'bbbb1111-0000-0000-0000-000000000001';
    raise exception 'a member set their own points';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.profiles set account_status = 'suspended'
     where id = 'bbbb1111-0000-0000-0000-000000000001';
    raise exception 'a member set their own account_status';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 5. gema.profiles is untouched by this migration.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema='gema' and table_name='profiles'
                and column_name in ('locale','timezone','account_status'))
  then raise exception 'the migration reached into gema.profiles'; end if;
end $$;

-- 6. The backfill: every Auth user is now a person in public.profiles, with
--    the same id, whether they came from gema.profiles or from auth alone.
do $$
declare missing int; blank int;
begin
  select count(*) into missing
    from auth.users u
   where not exists (select 1 from public.profiles p where p.id = u.id);
  if missing > 0 then
    raise exception '% Auth users still have no person row', missing;
  end if;

  -- Identity came across, not just an empty shell.
  if (select full_name from public.profiles
       where id = 'dddd0000-0000-0000-0000-000000000001') <> 'Has Gema'
  then raise exception 'full_name did not come across from gema.profiles'; end if;

  if (select phone from public.profiles
       where id = 'dddd0000-0000-0000-0000-000000000001') <> '09990000101'
  then raise exception 'phone did not come across from gema.profiles'; end if;

  -- An empty gema full_name falls back to the name parts, not to blank.
  if (select full_name from public.profiles
       where id = 'dddd0000-0000-0000-0000-000000000002') <> 'Names Only'
  then raise exception 'first/last name fallback did not fire'; end if;

  -- An orphan gets its auth metadata, and no card.
  if (select full_name from public.profiles
       where id = 'dddd0000-0000-0000-0000-000000000003') <> 'Orphan One'
  then raise exception 'orphan did not take its auth full_name'; end if;

  if exists (select 1 from public.profiles
              where id in ('dddd0000-0000-0000-0000-000000000003',
                           'dddd0000-0000-0000-0000-000000000004')
                and card_no is not null)
  then raise exception 'the backfill minted a Lifestyle card'; end if;

  select count(*) into blank from public.profiles
   where coalesce(btrim(full_name), '') = '';
  if blank > 0 then raise exception '% person rows have a blank name', blank; end if;
end $$;

rollback;
