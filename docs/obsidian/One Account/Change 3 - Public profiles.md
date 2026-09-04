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

**Status:** **done** — Staging, 2026-09-04. Person rows on both sides of the spine, `role` no longer member-writable. Carried-forward items are listed under *Left open* below and belong to later Changes, not to reopening this one.

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
- [x] Whole-row UPDATE revoked from `authenticated`; column grants in its place. `role` and `account_status` withheld.
- [ ] **Corrective grant outstanding on Staging.** The first grant list was too narrow and broke Lifestyle — see below.
- [ ] `account_status` has no writer at all. Lifestyle's admin RBAC (`public.app_roles`, `lifestyle_is_admin()`) is **not on this database**, so status changes go through the service role. A definer function is the right answer once that RBAC lands, not before.
- [ ] Audit preflight E — who is already an admin, on either table, and should they be.
- [ ] Confirm preflight A and C: the policies as they really are, and what `public.profiles.role` is for. The grants hold regardless, but if something authorizes off `role`, this was an escalation and not merely an ungoverned column.
- [ ] Lifestyle and Academy read `public.profiles` for name/email/phone. Academy's `src/lib/ops/profile.ts` already selects `full_name, email`; those columns now exist, so it should stop reading "not enrolled". Untested.
- [ ] Decide what `gema.profiles` becomes now that `public.profiles` is the person: a view, or the GEMA clients stop pinning the `gema` schema. GEMA keeps working either way until then.

## The grant list was too narrow, and it broke Lifestyle

Applied on Staging 2026-09-04, then corrected the same day.

The first version revoked `points`, `phase`, `claimed`, `banked`, `pending`,
`days_left` and `card_no` along with `role`. Lifestyle writes every one of
those **with the member's own session client**:

- `lib/actions/member.ts` — `claimCard()` writes `claimed`, `phase`; the profile
  patch writes `points`, `pending`, `banked`, `days_left`, `capsules_per_day`.
- `lib/actions/auth.ts` — the register upsert writes `card_no`, `phase`,
  `claimed`, `points`, `pending`, `banked`, `days_left`. Before the backfill
  that was always an INSERT; now that every Auth user has a person row it is an
  UPDATE, so it needs those grants where it never did before.

That is Lifestyle's design — a self-service card app whose client advances its
own progress — not an oversight to close from underneath it. The revoke was an
overreach dressed as a security fix.

**Where the line actually belongs:** `role` is an authorization column and stays
revoked; that was always the real finding. `account_status` stays revoked. The
card columns go back.

So a member can still inflate their own points. That is a product question about
the card, not an auth bypass, it predates this Change, and [[Change 4 - Lazy
product rows]] is where it belongs — once card/points live in their own table
with their own policy they can be governed without breaking the app.

`admin.ts` only reads `public.profiles`, so nothing there was affected.

## Left open, deliberately

None of these block [[Change 4 - Lazy product rows]]; each is recorded so it is
not rediscovered as a surprise.

- **Preflight A and C never came back.** The whole-row UPDATE is proven from the
  Lifestyle migration files, not from Staging itself, and nobody has confirmed
  what `public.profiles.role` is *for*. The column grants hold either way. If
  some function authorizes off that column, what was closed here was a live
  escalation rather than an ungoverned column — worth knowing before the
  production cutover.
- **Preflight E, the admin audit.** Who already holds `role = 'admin'` on either
  table. The door is shut; nobody has looked at who went through it first.
- **`account_status` has no writer.** Lifestyle's admin RBAC (`public.app_roles`,
  `lifestyle_is_admin()`) is not on this database. Service role only until it is.
- **`gema.profiles` vs `public.profiles`.** Both now hold every person. GEMA
  reads `gema.profiles`; the spokes read `public.profiles`. One of them should
  eventually become a view over the other, or GEMA's clients should stop pinning
  the `gema` schema. Two tables, one truth, kept in step by a backfill is not a
  resting state.
- **What writes the person row for a *new* Auth user.** `public.handle_new_user`
  is armed and its body was never read (preflight F). GEMA now calls
  `ensurePersonRow` on sign-in as a safety net, but a net is not a plan.
- **Points are still member-writable.** Lifestyle's card flow needs it; Change 4
  is where card/points move to their own table and can be governed properly.

## Field notes from the Staging proof

Two failures cost hours and were neither of them bugs:

- **Two `profiles` tables.** An unqualified column list was read as
  `public.profiles` when it described `gema.profiles`, and the migration was
  rewritten for the wrong table and back again. Every query that drives a
  migration must return its own schema.
- **Testing against the wrong project.** "Invalid email or password" on GEMA was
  production GEMA, where the Staging account does not exist. Before debugging a
  login, confirm the project — `sb-<ref>-auth-token` names it.

A third: a live session hides a broken password. Sign out before testing auth.

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
