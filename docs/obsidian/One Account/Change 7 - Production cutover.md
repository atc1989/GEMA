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

## Preflight answers, 2026-09-08 — production is a clean slate

Run by the owner on `rvwseybgimmewuoccecu`. This is better news than the note
was written to expect, and it removes two hazards outright.

**`public.profiles` does not exist on production.** Of every table the three
apps need, exactly two are there, and both are GEMA's own:

```text
gema.profiles
gema.ranks
```

Four things follow, and they simplify this Change:

1. **No silent-skip hazard.** `create table if not exists public.profiles` in
   Lifestyle's first migration genuinely creates it. The worst outcome this
   note was written to guard against — a migration reporting success onto a
   table with different columns — cannot happen.
2. **Zero name collisions.** On Staging exactly one name collided (`profiles`)
   and Academy's install file had to be generated and filtered around it. On
   production not even that one collides: Academy's `ranks` lives in `public`,
   GEMA's in `gema`. The collision set is empty, so Academy's schema installs
   as its migrations write it.
3. **The `role` escalation is a Staging artifact.** `public.profiles.role` —
   the column of unknown provenance that Change 3 revoked, and whose purpose
   preflight C was chasing — **does not exist on production**. All eleven
   mentions of `role` in `change3_shared_person_profiles.sql` are comments;
   the executable SQL never references that column, so it applies cleanly to a
   table that has never had one. Preflight C is moot here. It stays open on
   Staging, where the column is real.
4. **Change 3 applies safely to a freshly created Lifestyle table.** Traced
   rather than assumed: its section 3b guard refuses if `public.profiles` has a
   NOT NULL column with no default that the backfill does not fill, and
   Lifestyle's migration creates `name`, `mobile` and `card_no` as exactly
   that. Section **3 drops those NOT NULLs before 3b runs**, so the guard
   passes. Run out of order — Change 3 before Lifestyle's migrations, or its
   sections rearranged — it raises and rolls back, which is the correct
   failure but a confusing one if the reason is not written down.

### The part of Change 3 that writes to real GEMA rows

Not a hazard, but it must not be a surprise: **section 3c inserts into
`gema.profiles`**, and the statement after it rewrites `full_name` on rows
whose name is blank. On production that is the table holding the ~431 real
accounts.

Both are `on conflict do nothing` / conditional and expand-only — no row is
deleted, no column dropped, nobody's name is overwritten with something worse
than blank. It exists because filling `public.profiles` alone left a signed-in
member with no GEMA person row, and GEMA's landing loops forever on that. Still:
this Change writes to the production person table, and the owner should know
that before it runs rather than after.

## Preflight — read-only, on production, before anything is written

These answer questions this board has never been able to answer, because no
agent has had production access and none should. Run them in the SQL editor on
`rvwseybgimmewuoccecu` and paste the output back.

~~**A. Does `public.profiles` already exist?**~~ **Answered 2026-09-08: no.**

~~**B. Which of the tables the three apps need already exist.**~~ **Answered
2026-09-08: only `gema.profiles` and `gema.ranks`.** A full inventory of the
`public` schema is still worth taking, because the question asked about a fixed
list of names rather than everything that is there.

~~**C. What `public.profiles.role` is for.**~~ **Moot on production** — the
column does not exist. Still open on Staging.

**D. Who already holds admin — re-ask against `gema.profiles`.** The original
query named `public.profiles` and could not run. The question stands and is
unanswered: the door is shut, and nobody has looked at who went through it
first. On a database with ~431 real accounts this is the preflight that matters
most.

**E. What `public.handle_new_user` actually does.** Preflight F from Change 3,
never read. [[00 - Locks]]: a new Auth user creates a person only — never a
card, never an Academy BASE rank. On production that trigger fires for real
signups, and Academy's own `20260827120000_person_only_new_user` migration is
about to install alongside it. Two triggers on `auth.users` with opinions about
what a new user gets is exactly the thing the Locks forbid.

**F. Is the Confirm signup template a 6-digit code or a link?** Every sign-in
form in all three apps offers a code step, because Staging emails a code (the
GEMA partner template). Auth email templates are per project. If production
emails a link instead, the code box is a dead end for every new registration.

The SQL is handed over in chat, per the working rule: SQL in the message, not
just a file path.

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
4. **Academy's 14 migrations, in numeric order.** On Staging this needed a
   *generated, filtered* install file, because Academy's dump carried twelve
   statements that would have changed what Staging already owned — one of them
   `GRANT ALL ON TABLE public.profiles TO authenticated`, which would have
   silently undone Change 3's revoke. **Production has no collisions**
   (preflight B), so the migrations install as written.

   One thing to check rather than assume: that same `GRANT ALL` is emitted by
   `pg_dump`, not by Academy's migration files, so running the migrations
   should not reproduce it. Confirm that after step 4 by re-asserting what
   Change 3's test asserts — that a member cannot write privileged columns on
   `public.profiles` — before moving on. Do not reuse the Staging install file.
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
| Preflight A / C — what `role` is for | Change 3 | **Moot on production** — the column is not there. Open on Staging |
| Preflight E — who is already admin | Change 3 | **Preflight D above. Still blocking** |
| Academy reads `public.profiles` for name/email/phone | Change 3 | Re-test after step 4; it was never tested on Staging |
| `gema.profiles` vs `public.profiles` | Change 3 | **Decision 3 above. Blocking** |
| Owner: confirm rank catalog seeded | Change 4b | Re-do on production after step 4 |
| `profiles_scoped_read` on the shared person row | Change 4b | Decide with decision 3 |
| Ginhawa `/register/<event>` untouched | Change 4c | Out of scope. Still true |

## Next

Nothing. This is the last Change on the board.
