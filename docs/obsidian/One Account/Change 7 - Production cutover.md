---
title: Change 7 - Production cutover
aliases:
  - Change 7
  - Production cutover
tags:
  - gutguard
  - one-account
  - change
---

# Change 7 — Production cutover

**Status:** **not started. Owner-gated.** Nothing in this note may be run by an
agent. It exists so that when the owner says go, the work is a checklist rather
than a discovery exercise.

Read [[00 - Session gate]] and [[00 - Locks]] before this Change. Then read this
whole note before running the first statement — the order is the Change.

## What this is

The only thing left. One Account is finished and proven as an *engine*; it is
not finished as a *deployment*. Today:

```text
gema.gutguard.ph        Production   production Auth rvwseybgimmewuoccecu, ~431 real accounts
lifestyle.gutguard.ph   staging      Staging Auth fxdsnacuonfvutdquogb
gentrep.gutguard.ph     staging      Staging Auth fxdsnacuonfvutdquogb
```

Two Auth projects, so cross-app sign-in is off in the real world. See
[[Change 6b - Staging on the real domain]] — that split is deliberate and the
code is not at fault.

This Change puts all three apps on `rvwseybgimmewuoccecu` and moves the two
spoke domains back to Production. It is the moment the ~431 real accounts start
being served by three apps instead of one.

## What is already done, so nobody re-does it

- **No app code needs to change.** Every project reference, origin and cookie
  domain is read from the environment; a grep for `fxdsnacuonfvutdquogb` and
  `rvwseybgimmewuoccecu` across app code finds nothing outside `.env.example`,
  `README.md` and one test fixture. The cutover is SQL, environment variables
  and Vercel settings — not a branch of features.
- **Omit-when-unset is the safety net.** Every cross-app link renders nothing
  when its origin variable is missing, so a half-configured environment
  degrades instead of misleading. Do not "improve" it (Changes 4c, 5, 6b).
- **The engine is proven** end to end on the real domain, 2026-09-07, against
  Staging Auth. What is unproven is this shape of database, not this code.

## Four decisions the owner owns

None of these are agent calls, and three of them change the SQL.

1. **What happens to the Staging accounts.** Every one retires, including the
   ones that proved this board (`TEST_MANCERA`, `demo.admin`, `atcoriginalnew@`).
   There is no migration path — they are in the other project. Confirm that is
   understood rather than discovered afterwards.
2. **Do the ~431 real members get Lifestyle cards?** Change 4 says a card is
   minted on first visit, never at signup, so the answer can be "nothing, they
   get one when they show up". Confirm that, because the alternative — a bulk
   mint — is a different migration.
3. **`gema.profiles` vs `public.profiles`.** Inherited open item from
   [[Change 3 - Public profiles]]. Both hold every person on Staging, kept in
   step by a backfill and a trigger. Two tables and one truth is not a resting
   state, and doing this on production doubles the row count that has to stay in
   step. Decide before, not after: one becomes a view over the other, or GEMA's
   clients stop pinning the `gema` schema.
4. **Whether the member chrome ships first.** Lifestyle currently renders
   "Member" and a blank QR for a signed-in member, because the client session is
   a guest session whenever Supabase is on ([[Change 5 - Hub chrome]]). On
   Staging that is a cosmetic annoyance for test accounts. On production it is
   what 431 real members see. Recommend fixing it *before* the cutover, not
   after.

## Preflight — read-only, on production, before anything is written

These answer questions this board has never been able to answer, because no
agent has had production access and none should. Run them in the SQL editor on
`rvwseybgimmewuoccecu` and paste the output back.

**A. Does `public.profiles` already exist there, and what shape?** This decides
whether the Lifestyle migrations create it or collide with it. `create table if
not exists` will silently skip an existing table with different columns, which
is the worst outcome: a migration that reports success and leaves the app
broken.

**B. Which of the tables the three apps need already exist.** Lifestyle needs
`profiles, invites, dose_logs, base_progress, point_events, stories, orders,
webhook_events, app_roles`. Academy needs its 14 migrations' worth. On Staging
exactly one name collided — `profiles` ([[Change 4b - Academy on Staging]]).
Production is a different database and the collision set must be re-measured,
not assumed.

**C. Preflight A and C from Change 3, still outstanding.** What
`public.profiles.role` is *for*, and whether anything authorizes off it. If
something does, Change 3 closed a live escalation rather than an ungoverned
column — and that matters more on a database with real users.

**D. Preflight E from Change 3, still outstanding.** Who already holds
`role = 'admin'` or `is_admin` on either table. The door is shut; nobody has
looked at who went through it first.

**E. What `public.handle_new_user` actually does.** Preflight F, never read.
[[00 - Locks]]: a new Auth user creates a person only — never a card, never an
Academy BASE rank. On production that trigger fires for real signups.

**F. Is the Confirm signup template a 6-digit code or a link?** Every sign-in
form in all three apps offers a code step, because Staging emails a code (the
GEMA partner template). Auth email templates are per project. If production
emails a link instead, the code box is a dead end for every new registration.

The SQL for A–E is in the chat message that accompanies this note rather than
only here, per the working rule: hand SQL over, not a file path.

## The order, and why it is this order

Getting this wrong is the failure mode, because the pieces have real
dependencies on each other.

1. **Lifestyle's four migrations, in numeric order** —
   `20260822000000_lifestyle_member`, `20260825000000_identity_unique`,
   `20260902000000_lifestyle_admin_rbac`, `20260902010000_lifestyle_orders_stories`.
   These *create* `public.profiles` and the card tables. On Staging they were
   already there; on production they are the first thing.
2. **`change3_shared_person_profiles.sql`** — the person columns, the backfill,
   the column grants. **This file `alter table public.profiles`, so it cannot
   run before step 1 exists.** Its header says "Staging only"; that line is
   describing where it had been applied, and the file needs re-reading with
   production in mind before it is run — in particular its backfill, which on
   Staging populated 15 person rows and on production would populate ~431.
3. **`change4_lazy_product_rows.sql`** — clears the placeholder card number and
   adds the unique index. Its section 0 refuses to run against the wrong table,
   which is the guard that makes this safe to run at all.
4. **Academy's schema.** On Staging this was a *generated* install file, built
   by re-running the migrations on a throwaway Postgres and filtering twelve
   statements that would have changed what Staging already owned — one of them
   `GRANT ALL ON TABLE public.profiles TO authenticated`, which would have
   silently undone Change 3's revoke. **A production install file has to be
   generated the same way against production's real shape.** Do not reuse the
   Staging one.
5. **Environment variables**, all three projects, Production scope.
6. **Domains**, last.

Steps 1–4 are one maintenance window on a live database. Steps 5–6 are the part
that flips what members see.

## Environment matrix — Production scope, after the cutover

| Variable | Lifestyle | GEMA | Academy |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **new — has none today** | set | set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **new — has none today** | set | set |
| `SUPABASE_SERVICE_ROLE_KEY` | **new** | set | set |
| `NEXT_PUBLIC_SITE_URL` | `https://lifestyle.gutguard.ph` | `https://gema.gutguard.ph` | `https://gentrep.gutguard.ph` |
| `NEXT_PUBLIC_GEMA_URL` | `https://gema.gutguard.ph` | — | `https://gema.gutguard.ph` |
| `NEXT_PUBLIC_ACADEMY_URL` | `https://gentrep.gutguard.ph` | — | — |
| `NEXT_PUBLIC_LIFESTYLE_URL` | — | **the change** — Preview-only today | `https://lifestyle.gutguard.ph` |
| `NEXT_PUBLIC_ONE_ACCOUNT_COOKIE_DOMAIN` | `gutguard.ph` | `gutguard.ph` | `gutguard.ph` |
| `ONEGRINDERS_API_KEY` | set | set | set |

**`NEXT_PUBLIC_LIFESTYLE_URL` on GEMA Production is the single most dangerous
row in this table.** It is Preview-only today precisely so a real GEMA prospect
is never sent to a Lifestyle running Staging Auth to create an account in the
wrong project. It becomes safe **only after** Lifestyle Production is pointed at
`rvwseybgimmewuoccecu` — not before, not in the same deploy.

Setting `NEXT_PUBLIC_ONE_ACCOUNT_COOKIE_DOMAIN=gutguard.ph` on GEMA Production
changes the cookie scope of ~431 live sessions. Expect everyone to be signed
out once. That is the cost and it is worth naming out loud beforehand.

**Redeploy with the build cache OFF.** `NEXT_PUBLIC_*` is inlined at build time
and a cached build serves the old values — this cost a cycle in Change 6b.

## Domains, last

Move `lifestyle.gutguard.ph` and `gentrep.gutguard.ph` from the `staging` branch
back to Production, in Vercel → Domains → **Connect to an environment** (it is
not a "Git Branch" text field any more). `gema.gutguard.ph` does not move; it is
already Production and moving it is what locked real members out on 2026-09-07.

A domain on a branch serves a **Preview** deployment, and Preview requires a
Vercel login. Fine for staging. Never for an app with members.

## Rollback

Steps 5–6 are reversible in minutes: put the two spoke domains back on
`staging`, unset `NEXT_PUBLIC_LIFESTYLE_URL` on GEMA Production, redeploy with
the cache off. The apps return to today's split and GEMA is untouched throughout.

Steps 1–4 are **not** reversible in the same way. They are expand-only by
design — nothing renamed, nothing dropped, no row deleted — so a rollback is
"leave the new columns in place unused" rather than "undo". Take a database
backup before step 1 anyway.

## Done when

A real GEMA member signs in on `gema.gutguard.ph`, opens `lifestyle.gutguard.ph`
and `gentrep.gutguard.ph` without typing a password again, is offered a Lifestyle
card they did not have before, and is not enrolled in anything they did not ask
for. Verified by the owner in a browser, not by tests alone.

And: no Staging project reference remains in any Production environment
variable, in any of the three projects.

## Inherited open items, and where they land

Everything still unchecked on this board, so it is decided here rather than
rediscovered mid-cutover:

| Item | From | Lands |
|---|---|---|
| Corrective column grant on Staging | Change 3 | Staging housekeeping; production gets the corrected list from the start |
| `account_status` has no writer | Change 3 | Carry forward. Service role only until Lifestyle's RBAC is on the database |
| Preflight A / C — what `role` is for | Change 3 | **Preflight C above. Blocking** |
| Preflight E — who is already admin | Change 3 | **Preflight D above. Blocking** |
| Academy reads `public.profiles` for name/email/phone | Change 3 | Re-test after step 4; it was never tested on Staging |
| `gema.profiles` vs `public.profiles` | Change 3 | **Decision 3 above. Blocking** |
| Owner: confirm rank catalog seeded | Change 4b | Re-do on production after step 4 |
| `profiles_scoped_read` on the shared person row | Change 4b | Decide with decision 3 |
| Ginhawa `/register/<event>` untouched | Change 4c | Out of scope. Still true |

## Next

Nothing. This is the last Change on the board.
