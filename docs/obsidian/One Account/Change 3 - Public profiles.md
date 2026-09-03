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

Same id is the person in GEMA and in `public.profiles` on Staging, no member can
write their own `role`, and the GEMA member dashboard still loads.

## Next

[[Change 4 - Lazy product rows]]
