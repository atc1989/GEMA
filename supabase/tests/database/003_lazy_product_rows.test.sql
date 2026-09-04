-- Change 4 — lazy product rows. What the migration did to card numbers, and
-- what it left alone.
--
-- Runs inside a transaction that is rolled back, so it cannot see or leave
-- rows for another test.
begin;

do $$
declare
  v_card text;
  v_points integer;
  v_count integer;
  v_message text;
begin
  ------------------------------------------------------------------ 1. cleared
  -- The placeholder every member shared is read as "no card" by the app, so it
  -- has to be gone or those members are never re-minted.
  select count(*) into v_count
    from public.profiles
   where card_no is not null
     and regexp_replace(card_no, '\s+', ' ', 'g') = '0240 5578 9012 3456';
  if v_count <> 0 then
    raise exception 'the legacy placeholder card number survived on % row(s)', v_count;
  end if;

  -- Whitespace is not a distinct card number: the double-spaced copy went too.
  select card_no into v_card from public.profiles
   where id = 'eeee0000-0000-0000-0000-000000000002';
  if v_card is not null then
    raise exception 'a re-spaced placeholder survived as %', v_card;
  end if;

  -- A blank string sits outside the app's `card_no is null` mint guard.
  select card_no into v_card from public.profiles
   where id = 'eeee0000-0000-0000-0000-000000000005';
  if v_card is not null then
    raise exception 'a blank card number was left as % instead of null', quote_literal(v_card);
  end if;

  ------------------------------------------------------- 2. nothing else moved
  -- Clearing a card number must not touch the member behind it.
  select points into v_points from public.profiles
   where id = 'eeee0000-0000-0000-0000-000000000001';
  if v_points <> 120 then
    raise exception 'a re-minted member lost points: expected 120, found %', v_points;
  end if;

  -- Six people in, six people out. Nothing is deleted by this Change.
  select count(*) into v_count from public.profiles
   where id::text like 'eeee0000%';
  if v_count <> 6 then
    raise exception 'expected 6 fixture members, found %', v_count;
  end if;

  ------------------------------------------------------ 3. duplicates resolved
  -- The earliest row keeps the number; the later one is re-minted on next visit.
  select card_no into v_card from public.profiles
   where id = 'eeee0000-0000-0000-0000-000000000003';
  if v_card is distinct from '0240 1111 2222 3333' then
    raise exception 'the earliest holder lost the card number: %', quote_nullable(v_card);
  end if;

  select card_no into v_card from public.profiles
   where id = 'eeee0000-0000-0000-0000-000000000004';
  if v_card is not null then
    raise exception 'the later duplicate kept the card number: %', v_card;
  end if;

  -- A card number nobody else has is left exactly as it was.
  select card_no into v_card from public.profiles
   where id = 'eeee0000-0000-0000-0000-000000000006';
  if v_card is distinct from '0240 9999 8888 7777' then
    raise exception 'a distinct card number was disturbed: %', quote_nullable(v_card);
  end if;

  ------------------------------------------------- 4. the index is the backstop
  -- The app retries a mint on 23505. Without this the retry is decorative.
  begin
    update public.profiles set card_no = '0240 9999 8888 7777'
     where id = 'eeee0000-0000-0000-0000-000000000004';
    raise exception 'a second member took an existing card number';
  exception when unique_violation then
    null;
  end;

  -- Whitespace does not buy a duplicate either.
  begin
    update public.profiles set card_no = ' 0240  9999 8888  7777 '
     where id = 'eeee0000-0000-0000-0000-000000000004';
    raise exception 'a re-spaced copy of an existing card number was accepted';
  exception when unique_violation then
    null;
  end;

  -- And the normal state after Change 3 — many people, no card — is still legal.
  select count(*) into v_count from public.profiles where card_no is null;
  if v_count < 2 then
    raise exception 'cardless people should be the normal state, found %', v_count;
  end if;

  --------------------------------------------- 5. the member can still be a member
  -- Lifestyle's claimCard() and persistProfile() write these with the member's
  -- own session client. Change 3's first grant list omitted them and broke the
  -- card flow; this Change re-asserts them.
  set local role authenticated;
  set local request.jwt.claim.sub = 'eeee0000-0000-0000-0000-000000000006';
  update public.profiles set claimed = true, phase = 'claimed', points = 43
   where id = auth.uid();

  -- ...but not an admin. role stays revoked; that was Change 3's real finding.
  begin
    update public.profiles set role = 'admin' where id = auth.uid();
    raise exception 'a member wrote their own role';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.profiles set account_status = 'suspended' where id = auth.uid();
    raise exception 'a member wrote their own account status';
  exception when insufficient_privilege then
    null;
  end;
  reset role;

  ------------------------------------------------------ 6. the other profiles
  -- gema.profiles is a different table in a different schema and this Change
  -- does not touch it. Confusing the two cost Change 3 two rewrites.
  select count(*) into v_count
    from information_schema.columns
   where table_schema = 'gema' and table_name = 'profiles'
     and column_name in ('card_no', 'points', 'phase', 'claimed');
  if v_count <> 0 then
    raise exception 'gema.profiles grew % card column(s)', v_count;
  end if;

  select count(*) into v_count
    from pg_indexes where schemaname = 'gema' and indexname = 'profiles_card_no_uidx';
  if v_count <> 0 then
    raise exception 'the card index was created on gema.profiles';
  end if;

  ------------------------------------------------------------ 7. and on public
  select count(*) into v_count
    from pg_indexes
   where schemaname = 'public' and tablename = 'profiles'
     and indexname = 'profiles_card_no_uidx';
  if v_count <> 1 then
    raise exception 'profiles_card_no_uidx is not on public.profiles';
  end if;
end $$;

rollback;
