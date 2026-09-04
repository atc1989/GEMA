---
title: Change 4 - Lazy product rows
aliases:
  - Change 4
tags:
  - gutguard
  - one-account
  - change
---

# Change 4 — Lazy product rows

**Status:** **current**. Code and migration shipped 2026-09-04 on
`claude/gutguard-lazy-product-rows-0x6yte` in all three repos. Not yet applied to
Staging, and not yet signed in by the owner. [[Change 3 - Public profiles]]
closed on Staging 2026-09-04.

Read [[00 - Session gate]] and [[03 - Identity model]] before this Change.

## Goal

First Lifestyle visit creates the card/member row. First Academy visit creates the trainee row. GEMA `members` stay OneGrinders/onboard/convert only. No 431-row eager backfill.

## Vault reads

- Session gate, Locks, Decisions, Identity, UX
- Tech Stack: OWNER, Canonical, Supabase
- Design System: skip unless a first-visit empty state is new UI

## Work

- [x] Lifestyle: on authenticated visit, if no Lifestyle row, insert defaults from `public.profiles` (name, new card, phase invited, 0 points).
- [x] Academy: on authenticated visit, if no trainee/progress, create Academy-local row + member role + BASE **open**. Not completed.
- [x] GEMA signup / OneGrinders still must not call those inserts (already forbidden in Change 1–2).
- [x] Ginhawa register: Auth + person + Lifestyle row only.
- [x] A OneGrinders member opening Lifestyle gets a card built from their guild
  name, without ever seeing the register form (D13).
- [ ] **Owner: apply `GEMA/supabase/change4_lazy_product_rows.sql` to Staging.**
- [ ] **Owner: sign in and confirm.** Tests do not close this Change.

## "No card row" turned out not to mean "no row"

Change 3's backfill gave **every** Auth user a `public.profiles` row. So first
visit is not an insert — it is filling in the card half of a row that already
exists with `card_no` null. Change 3 dropped `NOT NULL` on `name`, `mobile`,
`card_no`, `sponsor` and `team` precisely so that row could exist without
minting a card, and this Change is what fills it.

Everything is guarded on `card_no is null`, so two visits racing produce one
card and the loser is a no-op. It cannot reset a card already in play.

## The card number was the same for everyone

`lib/mock/seed.ts` exports `CARD_NUMBER = '0240 5578 9012 3456'`, the register
action wrote that literal string onto every row, and there is no unique index,
so nothing ever objected. "A new card_no" is only true if the placeholder is
cleared and a duplicate becomes an error. Hence a migration this Change was not
expected to need.

`change4_lazy_product_rows.sql`, `public.profiles` only, expand-only, nothing
deleted:

1. Clears the placeholder — the app reads it as "no card", so those members are
   re-minted lazily on their next visit.
2. Clears blank strings, which sit outside the app's `card_no is null` guard.
3. Clears any other duplicate, earliest holder keeps it.
4. `profiles_card_no_uidx` — partial, whitespace-normalised. Cardless is the
   normal state after Change 3, so it has to be partial.
5. Re-asserts Change 3's corrective column grant, which that note still lists as
   outstanding on Staging. Not new work: Change 3's own file grants exactly
   these. Lifestyle's `claimCard()` and `persistProfile()` write them with the
   member's own session client. `role` and `account_status` stay revoked.

Card numbers are derived from the member's own `auth.users.id`, so a retried
visit asks for the same number rather than a second one, and the unique index
plus a re-derive is the collision backstop.

## Written with the service role, and it has to be

Not a preference:

- Change 3 revoked the whole-row UPDATE from `authenticated`, and its corrective
  column grant is still outstanding on Staging — a member's own session may not
  be able to write `card_no` there today.
- Academy's `academy.protect_profile_update` reverts `member_card` and
  `current_rank_id` for any non-admin, and `user_roles` is not a table a member
  may write ([[03 - Identity model]]: members must not write their own roles).

Enrolment is the app's decision, not the member's. Where no service key is
configured, Lifestyle falls back to the member's session client (what the
register upsert always used) and Academy declines to enrol at all — the member
still gets a working session and the "not enrolled" screen.

## What is proven, and how

`GEMA/supabase/tests/run.sh` — throwaway Postgres from the Staging shape,
Change 3 then Change 4, each applied twice:

```
before fix: member self-write -> admin / points=999999
change3_shared_person_profiles.sql             applied
re-apply (idempotency)                         ok
after fix:  member self-escalation -> permission denied for table profiles
before fix: members sharing a card number: 2
change4_lazy_product_rows.sql                  applied
re-apply (idempotency)                         ok
after fix:  duplicate card number -> duplicate key value violates unique constraint "profiles_card_no_uidx"
002_profiles_privilege.test.sql                PASS
003_lazy_product_rows.test.sql                 PASS
all green
```

`003` pins the placeholder cleared (including a re-spaced copy), blanks nulled,
the earliest duplicate holder keeping the number, a distinct number untouched,
points not lost by a re-mint, nobody deleted, the index rejecting both a
duplicate and a re-spaced duplicate, cardless still legal, the member still able
to write their own card columns but not `role` or `account_status`, and
`gema.profiles` untouched.

`gentrep-academy/supabase/tests/run.sh` — **new**, and the only place the
Academy schema exists at all right now. Applies all 13 Academy migrations to a
throwaway Postgres and runs `004_first_visit_trainee.test.sql`, which pins:
signup writing a person and no trainee row, a member unable to enrol themselves
(the profile guard reverts it, `user_roles` refuses them), the first visit
writing card + `member` role + BASE at `in_progress` with `completed_at` null
and no requirement completed for them, a second visit being a no-op, one member
card per member, and a person who never opened the Academy still not a trainee.

TypeScript, `node --test`: 9 tests on the shared person row, 10 on the Lifestyle
card, 11 on Academy enrolment. Lifestyle 75/75, Academy 112/112.

`tsc --noEmit`, `next build` and `eslint` are clean in all three repos. Two
things that only a real build catches, both fixed before this note was written:

- **Both repos target ES2017**, where a BigInt literal does not compile. The
  first card-number derivation used one; both mints now work in 32- and 12-bit
  slices instead. This is what turned the first Lifestyle Preview deployment red.
- **A first-visit helper wraps everything in try/catch** so a database problem
  cannot cost a page render — and that swallowed Next's own dynamic-rendering
  bail-out, which is how a route learns it read cookies. `isFrameworkControlFlow`
  re-throws redirects and bail-outs; the member layout also says
  `force-dynamic` outright rather than relying on the bail-out.

## Where the board and the code disagreed

- **Academy's half cannot be proven on Staging.** [[Change 2 - Shared login
  engine]]'s own Staging facts record `public.user_roles` and
  `public.member_rank_progress` as absent, and Change 3's fixture reproduces a
  Staging with no Academy catalog at all — no `ranks`, no `requirements`, no
  `teams`. There is nothing there for a trainee row to reference. The code path
  ships and degrades to the existing "not enrolled" screen, which is what
  Staging will show. See *Left open*.
- **"No card row" was not "no row"**, and **the card number was a shared
  placeholder** — both above.
- **The board implied no migration.** There is one, for the card number.
- **Board copies had drifted.** GEMA's said Change 4 was current; Lifestyle's
  and Academy's still said Change 3. Synced in this pass.

## Left open

- **The Academy catalog is not on Staging, and installing it is not this
  Change.** It is not a small follow-on either: Academy's `public.app_role` is
  `('member','trainer','staff','admin')` and Staging's is GEMA's
  `('prospect','member','host','admin')` — same name, same schema, different
  type. Academy's tables would have to move to their own schema (as GEMA's
  already have) or the enum reconciled. That is a Change of its own and an owner
  decision, not something to improvise here.
- **Card and points still live on `public.profiles`.** [[Change 3 - Public
  profiles]] expected Change 4 to do "the contract half — moving card/points out
  and dropping the duplicates left here". That is not on this Change's Work
  list, so it was not done. A member can still inflate their own points; that
  predates this Change and needs card/points in their own table with their own
  policy before it can be governed without breaking Lifestyle.
- **Change 3's preflight A, C and E never came back**, and its
  `account_status` writer is still service-role only. Unchanged by this Change.
- **`gema.profiles` vs `public.profiles`** — still two tables holding every
  person. Untouched here.

## Owner steps in

1. Apply `GEMA/supabase/change4_lazy_product_rows.sql` to **Staging only**
   (`fxdsnacuonfvutdquogb`). Production is a separate decision.
2. Sign out first — a live session hides a broken login — then sign in on
   Lifestyle Preview as a OneGrinders Staging user and confirm a card appears
   without registering. Check the cookie `sb-fxdsnacuonfvutdquogb-auth-token`
   names the project before debugging anything.
3. Open `/academy` on Academy Preview. Expect **"You're signed in / Training is
   not enrolled on this account yet"** until the Academy catalog is on Staging.
   That is the *Left open* item above, not a fault in this Change.

## Done when

OneGrinders Staging user opens Lifestyle and gets a card without registering. Academy stays empty until they open `/academy`.

## Next

[[Change 5 - Hub chrome]]
