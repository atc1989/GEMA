---
title: Change 4b - Academy on Staging
aliases:
  - Change 4b
  - Academy catalog
tags:
  - gutguard
  - one-account
  - change
---

# Change 4b — Academy on Staging

**Status:** **current**. Opened 2026-09-04 from a live failure, and numbered 4b
rather than renumbering [[Change 5 - Hub chrome]] and [[Change 6 - Shared domain SSO]].

Read [[00 - Session gate]], [[00 - Locks]] and [[03 - Identity model]] before this Change.

## Why this exists

[[Change 4 - Lazy product rows]] shipped the Academy trainee row and recorded,
under *Left open*, that the Academy catalog is not on Staging. That was a note.
Then someone signed in and hit it:

> Training is not enrolled on this account yet.

It is not an account problem. `enrol_academy_member.sql` run against Staging
reports what is actually wrong:

```
ERROR: Database postgres has no Academy catalog: public.certificates,
public.event_bookings, public.member_rank_progress, public.ranks,
public.requirement_completions, public.requirements, public.training_documents,
public.training_events, public.user_roles missing.
```

Nine of the ten tables the dashboard reads are absent. Staging carries the
Lifestyle card table at `public.profiles` and none of Academy's schema.

## What was measured, not assumed

Academy's 13 migrations were applied to a throwaway Postgres built from the real
Staging shape (Change 3 and Change 4 included). All 13 failed, and **every
failure traced to one line** — `20260813120000_init.sql:11`:

```
ERROR: type "app_role" already exists
```

Staging's `public.app_role` is GEMA's — `prospect, member, host, admin`.
Academy's is `member, trainer, staff, admin` plus `academy_operator`.

**The enum reconciles, non-destructively.** Proven:

```
before:  prospect, member, host, admin
after:   prospect, member, host, admin, trainer, staff, academy_operator
```

`alter type ... add value if not exists` adds; it never removes, so nothing GEMA
authorizes off changes. With the enum extended, the next collision is
`relation "profiles" already exists` — and that one is the real decision.

## The decision this Change rests on

Academy's schema wants `member_card`, `team_id` and `current_rank_id` on
`public.profiles`. On Staging that is the shared person row, and
[[00 - Session gate]] forbids it outright:

> Do not put Lifestyle points or Academy ranks on the shared person row.

[[00 - Locks]]: `Person ≠ GEMA distributor ≠ Academy trainee ≠ Lifestyle card`.

So the cheap fix — extend the enum, bolt three columns onto `public.profiles` —
is not available. Instead, and matching what GEMA already does by pinning the
`gema` schema:

- **Academy's product tables move to their own schema, `academy_app`.**
- **`public.profiles` stays the person**, unchanged, shared.
- **`academy_app.trainees`** holds `member_card`, `team_id`, `current_rank_id`,
  `is_demo`, keyed on the same `auth.users.id`.

Owner decisions, taken 2026-09-04: this Change comes **before** Change 5, and
the `academy_app` migration becomes **canonical** — Academy's own project is
disposable (D5: Academy has no real users), so there is one schema definition in
the repo and no drift.

## Work

- [x] Extend `public.app_role` with `trainer`, `staff`, `academy_operator`. In the install script's first transaction.
- [x] The trainee row off the person row — `public.academy_trainees` (migration `20260904120000_academy_trainees.sql`).
- [x] The Academy catalog on Staging — **already installed**, confirmed by
  `verify_staging_collisions.sql` on 2026-09-05. The generated install script
  written for this was unnecessary and has been deleted; see below.
- [x] App, seeds and scripts read the trainee table: 5 app files, 6 SQL scripts, 4 Node scripts.
- [x] Prove end to end on a database built from the real Staging shape.
- [ ] **Owner: confirm the rank catalog is seeded, then sign in.**
- [ ] Decide `profiles_scoped_read` on the shared person row — see *Left open*.

## The schema decision, revised

This note first said Academy's tables would move to their own `academy_app`
schema, mirroring how GEMA pins `gema`. Measuring it changed the answer, and the
measurement is worth keeping:

**Of Academy's 18 tables, exactly one name collides with anything on Staging:
`profiles`.** Not `ranks`, not `user_roles`, not `member_rank_progress` — none
of them exist there. A separate schema would have bought namespacing against a
collision set of zero, and cost 23 function bodies re-targeted, 25 policies
re-pointed, and an owner-only Settings → API step.

So Academy's tables install into `public` as they are, and the one real
collision is answered by the split the Locks demanded anyway:
`public.academy_trainees` holds the trainee, `public.profiles` stays the person.
Owner decision, 2026-09-04.

## Scale, so nobody is surprised

18 tables, 133 policies and functions, 3,382 lines of existing migration. The
app side is far smaller: **5 files, 30 references** touch the trainee columns,
because Change 4 localised that logic already.

## What is proven

Against a throwaway Postgres built from the real Staging shape — the Change 3
and Change 4 migrations applied on top of the Lifestyle card table:

```
install applies                          clean
catalog seeds                            5 ranks, 27 requirements, 4 documents
enrol_academy_member.sql                 Enrolled has.gema@example.invalid
member reads: name=Has Gema rank=BASE role=member BASE=in_progress
Change 3 holds: role writable by member  no
```

Also green: Academy 112/112 TypeScript tests, both database tests on the local
harness, `tsc --noEmit`, `next build`, `eslint`.

## The install script was unnecessary, and is gone — 2026-09-05

`verify_staging_collisions.sql`, run against Staging, settled it: **the Academy
catalog is already there.** Every table the dashboard reads exists — `ranks`,
`user_roles`, `member_rank_progress`, `requirements`, `training_documents`,
`training_events`, `certificates`, `teams` — along with `academy_trainees` and
`academy.protect_trainee_update`, which are this Change's own migration. All ten
types exist. `public.app_role` already reads
`prospect,member,host,admin,trainer,staff,academy_operator`.

Only `cms_entries` and `support_cases` are absent, and neither is read by the
member dashboard.

So `install_academy_on_staging.sql` — 3,463 generated lines — had nothing left
to install and would now fail on every table it names. It is deleted, with its
generator. The trainee migration, the enrolment script and the tests stay;
those are small and they are what actually did the work.

The lesson is cheap to write and was expensive to learn: **probe the database
before building anything to change it.** The install was built against a fixture
that was missing an `academy` schema Staging had, and the schema it was written
to add was already installed.

## The cardless-trainee bug, found and fixed — 2026-09-05

Enrolling by SQL exposed a defect in Change 4's own wiring. `claimMemberCard`
upserted with `ignoreDuplicates`, i.e. `ON CONFLICT DO NOTHING`. On a trainee
row that already existed it reported success and wrote nothing — so a row with
a null `member_card` could never be given one, on that visit or any visit after.

That is exactly the row `enrol_academy_member.sql` writes. Its header promises
*"leaves member_card null on purpose — the app mints it"*, and the app could
not keep that promise. Anyone enrolled by SQL was permanently cardless.

The port is now two: `createTrainee` is a plain insert that reports its
conflict, and `fillMemberCard` updates under a `member_card is null` guard.
The decision between them sits in `first-visit.ts`, where it is tested rather
than assumed — four new cases, including a member who already has a card
keeping it, and a card collision during the fill being re-derived.

## Owner steps in

1. Run `gentrep-academy/supabase/verify_academy_enrolment.sql` with your email.
   It reports whether the rank catalog is **seeded** (present is not the same as
   seeded) and whether that account has a trainee row.
2. If BASE is missing, run the catalog half of `gentrep-academy/supabase/seed.sql`.
3. Open `/academy`. The trainee row is created on that first visit — no SQL per
   account.

## Left open

- **`profiles_scoped_read` on the shared person row.** Academy's own schema has
  a policy widening SELECT on `public.profiles` to trainers, staff, operators
  and admins. The install deliberately does not apply it: that is a security
  change to a table Lifestyle and GEMA also read, and it should be decided on
  its own terms rather than arrive inside a catalog install. Consequence: a
  member's own dashboard works, the **trainer and staff desks cannot read other
  members' names** until it is decided.
- **`seed.sql`'s demo-identity half needs real Supabase `auth.users`** — it
  writes `instance_id`, which the local harness stub does not have. The catalog
  half runs anywhere. Not a fault; just where the seam is.

## Done when

A signed-in Staging account opens `/academy` and gets the dashboard, and a new
account gets its trainee row on first visit with no SQL run per account.
Verified by the owner signing in, not by tests.

## Next

[[Change 5 - Hub chrome]]
