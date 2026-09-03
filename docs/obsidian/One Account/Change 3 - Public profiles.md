---
title: Change 3 - Public profiles
aliases:
  - Change 3
tags:
  - gutguard
  - one-account
  - change
---

# Change 3 — Public profiles

**Status:** current. [[Change 2 - Shared login engine]] is closed.

Read [[00 - Session gate]] and [[03 - Identity model]] before this Change.

## Goal

One person table at `public.profiles` with **the same UUIDs** as `auth.users` / existing `gema.profiles`. Lifestyle and Academy read it. GEMA keeps working.

## Vault reads

- Session gate, Locks, Decisions, Identity model
- Tech Stack: OWNER, Canonical, **Supabase** (RLS, views `security_invoker`)
- Design System: skip

## What `public.profiles` actually is today

One table name, three shapes, and they have already collided:

| Written by | Columns |
|---|---|
| Lifestyle `20260822000000_lifestyle_member` — **this is what Staging has** | `name`, `mobile`, `email`, `sponsor`, `team`, `card_no`, `phase`, `claimed`, `points`, `pending`, `banked`, `days_left`, `capsules_per_day`, … |
| Academy `20260813120000_init` | `full_name`, `member_card`, `team_id`, `current_rank_id`, `is_demo` |
| Academy `20260827120000_person_only_new_user` expects | `full_name`, `email`, `account_status` |

Academy's `src/lib/ops/profile.ts` already selects `full_name, email` from
`public.profiles`. On Staging those columns do not exist, which is why an
Academy member reads as **not enrolled**. This is live, not hypothetical.

Two consequences worth naming:

- **A person cannot exist without a card.** `name`, `mobile` and `card_no` are
  `NOT NULL` and `card_no` has no default, so any insert into `public.profiles`
  mints a Lifestyle card. [[00 - Locks]] forbids exactly that. Change 1's
  person-only trigger cannot be applied to Staging until this is fixed — its own
  header says so.
- **Members can write their own points.** `profiles_update_own` grants UPDATE on
  the whole row, so an authenticated member can PATCH `points`, `banked`,
  `phase` and `claimed`. RLS cannot express column limits; column `GRANT`s can.

## Work

- [ ] Staging only: `public.profiles` identity columns (full_name, email, phone, avatar, locale, timezone, account_status, last_seen). Same ids as Auth. *(written: Lifestyle `supabase/migrations/20260904000000_shared_person_profiles.sql` — expand only, nothing renamed or dropped)*
- [ ] Backfill `full_name`/`phone` from the Lifestyle `name`/`mobile` columns, and keep both spellings in step with a trigger until Change 4 drops the old ones. Do not drop `gema.profiles` until GEMA has a compatibility view or a public identity client.
- [ ] Drop `NOT NULL` on the card columns so a person row can exist without a card.
- [ ] RLS: own row read/update except status. Column `GRANT`s for the writable identity columns; `account_status` through `public.set_account_status()`, admin only.
- [ ] Reconcile the six Auth users with no person row — decide what each one is. Not a backfill.
- [ ] Lifestyle and Academy read `public.profiles` for name/email/mobile. Stop treating a wide Lifestyle `profiles` as the person if those columns still mix card/points — split is Change 4.

## Proven locally, not yet on Staging

`supabase/tests/run.sh` in Lifestyle builds a throwaway Postgres, applies every
Lifestyle migration in order, then runs `tests/database/*.test.sql`. On a clean
rebuild the Change 3 migration applies to the real schema, is idempotent on a
second run, and the test passes. What the test pins:

- `full_name`/`phone` backfill from `name`/`mobile`, and the two spellings stay
  in step in both directions.
- A person row can exist with no `card_no` — the Lock that the `NOT NULL`s made
  unenforceable. The insert `academy.handle_new_user()` performs now succeeds.
- `account_status` rejects a value outside the allowed set.
- `authenticated` holds no UPDATE grant on `points`, `pending`, `banked`,
  `phase`, `claimed`, `account_status`, `card_no`, `sponsor`, `team`,
  `days_left` — and still holds one on `full_name`.
- A non-admin calling `set_account_status()` is refused.

Checked by hand in the same harness: a member updating another member's row
affects 0 rows, and a member attempting `points = 999999` on their own row is
refused while their real balance is untouched.

This proves the migration **applies**. It does not prove Staging matches these
migration files — that is the preflight below, and it has to come back first.

## Preflight before applying

`supabase/verify_change3_preflight.sql` in Lifestyle, read-only. The migration was
written from this repo's migration files; the preflight checks Staging actually
matches them. The Staging report of 2026-09-03 mentioned a `role text` column on
`public.profiles` that **no migration in any of the three repos creates** — section 1
settles what is really there. Do not apply the migration until it agrees.

## Owner steps in

None unless Staging SQL must be applied in the dashboard by hand. Agent uses Staging MCP/SQL, not production.

## Done when

Same id is the person in GEMA and in `public.profiles` on Staging. GEMA member dashboard still loads.

## Next

[[Change 4 - Lazy product rows]]
