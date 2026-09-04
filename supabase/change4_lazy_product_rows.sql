-- Change 4 — lazy product rows: the database half.
--
-- Staging only (fxdsnacuonfvutdquogb). Production Auth rvwseybgimmewuoccecu is
-- untouched, and nothing here reads or writes it.
--
-- WHICH TABLE THIS IS. There are two named `profiles` on this database and
-- confusing them cost Change 3 two rewrites:
--
--   public.profiles  the Lifestyle card table (name, mobile, card_no, phase,
--                    points, ...) plus the identity columns Change 3 added.
--                    THIS FILE CHANGES THIS ONE, AND ONLY THIS ONE.
--   gema.profiles    GEMA's person table. Not touched. The tests assert that.
--
-- WHAT CHANGE 4 IS. The card is created on the member's first Lifestyle visit,
-- not at signup (00 - Locks: a new Auth user creates a person only). The app
-- half lives in GutGuard-Life-Style/lib/lifestyle/. This file does the one
-- thing the app cannot do for itself: make a card number mean something.
--
-- Until now every member got the same one. `lib/mock/seed.ts` exports
-- CARD_NUMBER = '0240 5578 9012 3456' and the register action wrote that exact
-- string onto every row, and there is no unique index, so nothing objected.
-- Change 4 says "a new card_no". That is only true if:
--
--   1. the placeholder is cleared, so the app re-mints those members lazily on
--      their next visit — a card that is not distinct is not a card; and
--   2. a unique index makes a collision an error the app can retry, rather than
--      a duplicate nobody notices.
--
-- Blank card numbers become NULL for the same reason: the app's mint is guarded
-- on `card_no is null`, and an empty string would sit outside that guard
-- forever.
--
-- EXPAND ONLY. No column is renamed or dropped, and no row is deleted. A member
-- whose card number is cleared keeps their points, phase, name and everything
-- else; they get a distinct number on their next visit.

begin;

-- 0. Refuse rather than half-apply if this is not the Lifestyle card table.
--    Schema-qualified, and it reports which database it ran on.
do $$
declare missing text;
begin
  select string_agg(wanted, ', ' order by wanted) into missing
    from unnest(array['card_no', 'phase', 'points', 'claimed', 'full_name']) as wanted
   where not exists (
     select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = wanted
   );
  if missing is not null then
    raise exception
      'public.profiles on database % is not the Change 3 shape: missing %. Apply change3_shared_person_profiles.sql first.',
      current_database(), missing;
  end if;
end $$;

-- 1. The placeholder every member shared. Read as "no card" by the app
--    (lib/lifestyle/card.ts), so clearing it is what makes the next visit mint
--    a real one.
update public.profiles
   set card_no = null
 where card_no is not null
   and regexp_replace(card_no, '\s+', ' ', 'g') = '0240 5578 9012 3456';

-- 2. Blank strings are not card numbers either.
update public.profiles
   set card_no = null
 where card_no is not null
   and btrim(card_no) = '';

-- 3. Any other duplicate: the earliest row keeps the number, the rest are
--    re-minted on their next visit. Nothing is deleted.
with ranked as (
  select id,
         row_number() over (
           partition by regexp_replace(btrim(card_no), '\s+', ' ', 'g')
           order by created_at, id
         ) as position
    from public.profiles
   where card_no is not null
     and btrim(card_no) <> ''
)
update public.profiles p
   set card_no = null
  from ranked r
 where p.id = r.id
   and r.position > 1;

-- 4. Now it can be enforced. Partial, because a person without a card is the
--    normal state after Change 3 — that is the whole point of lazy rows.
--
--    The app retries on 23505 with a re-derived number, so this index is the
--    backstop that makes the retry meaningful rather than decorative.
create unique index if not exists profiles_card_no_uidx
  on public.profiles (regexp_replace(btrim(card_no), '\s+', ' ', 'g'))
  where card_no is not null and btrim(card_no) <> '';

-- 5. Change 3's corrective grant, re-asserted.
--
--    Not new work and not a widening: Change 3's own file already grants these,
--    and its note records the grant as outstanding on Staging after the first,
--    too-narrow list was applied and rolled back by hand. Lifestyle's
--    claimCard() and persistProfile() write these columns with the MEMBER'S OWN
--    session client, so without them the card flow is broken on this database.
--
--    `role` and `account_status` stay revoked. That was the real finding, and
--    nothing here reopens it.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'card_no'
  ) then
    execute 'grant update (card_no, phase, claimed, points, pending, banked, days_left) '
            'on public.profiles to authenticated';
  end if;
end $$;

commit;
