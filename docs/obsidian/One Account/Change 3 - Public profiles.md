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

**Status:** current. DB half **applied to Staging 2026-09-04** — every Auth user is a person in `public.profiles` at the same id (`still_missing = 0`). App reads and the admin audit remain. [[Change 2 - Shared login engine]] is closed.

Read [[00 - Session gate]] and [[03 - Identity model]] before this Change.

## Goal

One person table at `public.profiles` with **the same UUIDs** as `auth.users` / existing `gema.profiles`. Lifestyle and Academy read it. GEMA keeps working.

## Vault reads

- Session gate, Locks, Decisions, Identity model
- Tech Stack: OWNER, Canonical, **Supabase** (RLS, views `security_invoker`)
- Design System: skip

## The two tables — settled, 2026-09-04

One database, two tables named `profiles`. Confusing them cost this Change two
rewrites, so they are written out here in full:

| | |
|---|---|
| **`public.profiles`** | `id, name, mobile, email, sponsor, team, card_no, phase, claimed, points, pending, banked, days_left, capsules_per_day, telegram, facebook, notifications, welcome_seen, created_at, updated_at, role` — the Lifestyle card table, **plus a `role` column that no Lifestyle migration in that repo creates**. |
| **`gema.profiles`** | `id, email, first_name, last_name, full_name, created_at, updated_at, phone, role, is_admin, avatar_url, last_seen_at, can_publish_events` — GEMA's person table. What the GEMA app reads; every client in `GEMA/src/lib/supabase` pins `db: { schema: "gema" }`. |

How the confusion happened, so it does not happen again: an unqualified column
list was read as `public.profiles` when it described `gema.profiles`. The
migration was rewritten for the wrong table, then rewritten back. **Every query
that drives a migration is now schema-qualified and returns its own schema in
the result.** Nothing was applied to any database at any point.

The Change targets `public.profiles`. `gema.profiles` is not touched, and the
test asserts that.

## What the migration does

Expand only — nothing renamed, nothing dropped. Lifestyle keeps writing
`name`/`mobile` and keeps working; Change 4 does the contract half.

- Adds `full_name`, `phone`, `avatar_url`, `locale`, `timezone`,
  `account_status`, `last_seen_at`, backfilled from `name`/`mobile` and kept in
  step by a trigger.
- Drops `NOT NULL` on `name`, `mobile`, `card_no`, `sponsor`, `team`. Until
  this, a person row could not exist without minting a Lifestyle card — which
  [[00 - Locks]] forbids, and which is why Change 1's person-only trigger says
  it cannot be applied here yet.
- Revokes the whole-row UPDATE from `authenticated` and grants back only the
  columns a person may edit about themselves.
- Puts `account_status` behind `public.set_account_status()`, admin only.
- Aborts whole, before changing anything, if `public.lifestyle_is_admin()` is
  absent.

## The reconcile problem, answered — section G, 2026-09-04

**All 15 Auth users came back `has_public_profile: false`.** Not one person
exists in `public.profiles`. The table has the Lifestyle card shape and no
people in it, so the identity backfill from `name`/`mobile` updates nothing.
Adding columns alone would leave this Change's own "done when" false.

The users split cleanly in two, and they are different problems:

| | |
|---|---|
| **9 users** — `demo.*@gentrep.academy`, `testuser@test.com`, `nmapantas_2022000461@uic.edu.ph`, `testaccoount@onegrindersguild.local` | Have a `gema.profiles` row. Identity copies across at the same id. |
| **6 users** — `atcoriginalnew@`, `najeebmapantas21@`, `lamnvisuals2020@`, `lukeaizone123@`, `jndlonsod@`, `jerickquijano29@` | Have neither. All created **2026-08-08 to 08-13**; every account from **08-27** onward has a `gema.profiles` row. |

That date boundary is the finding. These six are not corrupt rows to repair —
they predate whatever began writing `gema.profiles`, which is around when
Change 1 landed. All that is known about them is their auth record, so that is
what they get: email, and a name from `raw_user_meta_data` falling back to the
address local-part. **A person row, never a card** — [[00 - Locks]].

Both populations are filled by step 3b of the migration, idempotently. A guard
ahead of it refuses the whole transaction if `public.profiles` has a `NOT NULL`
column with no default that the inserts do not supply — `role` being the one
whose type and default are still unconfirmed.

## Why the grants matter

`profiles_update_own` (Lifestyle `20260822000000`) is `for update using (id =
auth.uid())` **with no column limits**. A signed-in member can PATCH their own
`points`, `banked`, `phase`, `claimed` — and `role`, the column of unknown
provenance. [[03 - Identity model]]: members must not write their own roles, on
any column. RLS cannot express column limits; column `GRANT`s can, and do not
depend on a policy's with-check staying correct as policies get redefined.

`GEMA/supabase/tests/run.sh` reproduces both tables on a throwaway Postgres and
prints:

```
before fix: member self-write -> admin / points=999999
change3_shared_person_profiles.sql             applied
re-apply (idempotency)                         ok
after fix:  member self-escalation -> permission denied for table profiles
002_profiles_privilege.test.sql                PASS
```

The test pins the backfill and both sync directions, a cardless person row, the
`account_status` constraint, the absence of any member UPDATE grant on the
thirteen privileged columns, the presence of one on `full_name`, a non-admin
refused by `set_account_status()`, and that `gema.profiles` was not touched.

This proves the migration applies and does what it says on this shape. It does
not prove Staging carries these policies — that is preflight A, outstanding.

## Work

- [x] Identity columns on `public.profiles` — `full_name`, `phone`, `avatar_url`, `locale`, `timezone`, `account_status`, `last_seen_at`.
- [x] `NOT NULL` dropped on `name`, `mobile`, `card_no`, `sponsor`, `team`, so a person can exist without a Lifestyle card ([[00 - Locks]]).
- [x] Backfill. All 15 Auth users have a person row at the same id — 9 copied from `gema.profiles`, 6 built from their auth record. Confirmed on Staging: `still_missing = 0`.
- [x] Whole-row UPDATE revoked from `authenticated`; column grants in its place. **Confirmed on Staging 2026-09-04**: `authenticated` holds UPDATE on exactly the 14 identity columns and on none of `role`, `points`, `pending`, `banked`, `phase`, `claimed`, `account_status`, `card_no`, `sponsor`, `team`, `days_left`. A member can no longer write their own role or points.
- [ ] `account_status` has no writer at all. Lifestyle's admin RBAC (`public.app_roles`, `lifestyle_is_admin()`) is **not on this database**, so status changes go through the service role. A definer function is the right answer once that RBAC lands, not before.
- [ ] Audit preflight E — who is already an admin, on either table, and should they be.
- [ ] Confirm preflight A and C: the policies as they really are, and what `public.profiles.role` is for. The grants hold regardless, but if something authorizes off `role`, this was an escalation and not merely an ungoverned column.
- [ ] Lifestyle and Academy read `public.profiles` for name/email/phone. Academy's `src/lib/ops/profile.ts` already selects `full_name, email`; those columns now exist, so it should stop reading "not enrolled". Untested.
- [ ] Decide what `gema.profiles` becomes now that `public.profiles` is the person: a view, or the GEMA clients stop pinning the `gema` schema. GEMA keeps working either way until then.

## Preflight before applying

`GEMA/supabase/verify_change3_outstanding.sql`, read-only, every query
schema-qualified. Outstanding and gating the apply:

- **A** — policies on both tables. The whole-row UPDATE is proven from the
  Lifestyle migration files, not from Staging itself.
- **B** — column grants already in place.
- **C** — what `public.profiles.role` actually is, and whether any admin
  predicate reads it. If something authorizes off it, this is an escalation and
  not merely an ungoverned column.
- **D** — whether `lifestyle_is_admin()` and `app_roles` exist here. The
  migration aborts without them.
- **E** — who is already an admin, on either table.
- **F** — what a new Auth user writes today.
- **G** — Auth users missing from each person table, for the reconcile step.

## Owner steps in

Run the preflight and hand back 2, 3, 5b, 9, 10. Then apply
`change3_shared_person_profiles.sql` to **Staging only**.

Production is a separate decision and a separate conversation: the same policy
and `is_admin()` live in `schema.sql`, so the escalation may exist against the
real accounts too. Running the preflight against production is read-only and
safe; applying anything there is not this Change's business.

## Done when

Same id is the person in GEMA and in `public.profiles` on Staging — **met
2026-09-04** — no member can write their own `role`, and the GEMA member
dashboard still loads. The last two are confirmed by preflight B and by signing
in, not by the migration having run.

## Next

[[Change 4 - Lazy product rows]]
