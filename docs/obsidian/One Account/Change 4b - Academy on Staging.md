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
- [x] The Academy catalog for Staging — `gentrep-academy/supabase/install_academy_on_staging.sql`, generated.
- [x] App, seeds and scripts read the trainee table: 5 app files, 6 SQL scripts, 4 Node scripts.
- [x] Prove end to end on a database built from the real Staging shape.
- [ ] **Owner: apply the install, seed the catalog, sign in.**
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

## What the install file is, and why it is generated

`install_academy_on_staging.sql` is the end state of Academy's migrations minus
twelve statements that would change what Staging already owns. The generated
file lists all twelve in its trailer, so the omissions are reviewable rather
than implied.

**One of the twelve is the reason this is filtered rather than concatenated.**
`pg_dump` emits `GRANT ALL ON TABLE public.profiles TO authenticated`. Applying
that would silently undo [[Change 3 - Public profiles]] — the whole-row UPDATE
revoke that closed the `role` escalation — on the row Lifestyle and GEMA share.
It is dropped, and the test asserts `role` is still unwritable afterwards.

`scripts/generate-staging-install.sh` rebuilds the file from a throwaway
Postgres with the migrations applied in order. Add a migration, regenerate,
commit. Editing the SQL by hand is how it drifts from what it mirrors.

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

## Owner steps in

1. Apply `gentrep-academy/supabase/install_academy_on_staging.sql` to **Staging
   only** (`fxdsnacuonfvutdquogb`). It extends the enum in its first
   transaction, then installs the catalog in a second.
2. Run the catalog half of `gentrep-academy/supabase/seed.sql` — teams, ranks,
   requirements, training documents. **Present is not the same as seeded**, and
   enrolment refuses without a BASE rank.
3. Sign in and open `/academy`. The trainee row is created on that first visit;
   no SQL per account.
4. Nothing to change in Settings → API. Everything lands in `public`, which is
   already exposed — that step existed only for the `academy_app` design that
   the measurement above ruled out.

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
