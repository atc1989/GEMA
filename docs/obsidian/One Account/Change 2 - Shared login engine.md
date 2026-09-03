---
title: Change 2 - Shared login engine
aliases:
  - Change 2
tags:
  - gutguard
  - one-account
  - change
---

# Change 2 — Shared login engine

**Status:** done · Staging proof recorded 2026-09-03. [[Change 1 - Staging identity freeze]] remains closed; production Auth untouched.

Read [[00 - Session gate]] before this Change.

## Goal

Username or email + password behaves the same on Lifestyle, GEMA, and Academy. OneGrinders is the username verifier everywhere.

## Vault reads

- Session gate, Locks, Decisions, Architecture, UX
- Tech Stack: OWNER, Canonical, Supabase, Frontend, Deploy
- Design System: OWNER, Visual Foundations, Dialects, Portable CSS — **if** login UI is touched

## Work

- [x] Extract GEMA login behavior (OneGrinders local-first, API, backup, email password, `redirectTo`, throttle) into a portable module. Do not copy Tailwind. *(`one-account/`: no UI, no `next/*`, no redirects — mirrored byte-for-byte into all three repos, with a manifest test that fails on drift)*
- [x] Lifestyle and Academy call that behavior. Identifier field: “Username or email”. *(each app keeps its own field styling and its own landing)*
- [x] OneGrinders provisioner still writes GEMA profile/member as today. It must **not** write Academy BASE or Lifestyle cards (Change 4). *(a spoke missing the member table degrades to a working session instead of a 500)*
- [x] `ONEGRINDERS_API_KEY` server-only on any app that hosts login. *(read server-side only and named in each `.env.example`; the Vercel Preview values are still owner)*
- [x] Prove on Staging: one OneGrinders username signs into Lifestyle, GEMA, and Academy with the same password, and an email admin login still works. *(2026-09-03: `TEST_MANCERA` + email twin `demo.admin@gentrep.academy` on Lifestyle, Academy/`gentrep.gutguard.ph`, and GEMA Preview `gema-betqmptet-atcs-projects-2f85c923.vercel.app`. Production GEMA ivory excluded. OneGrinders-unavailable safe failure also verified on Academy Preview. Passwords not recorded. Restore Preview `ONEGRINDERS_API_KEY` after the outage test.)*

## Shipped this pass

Two Change 2 branches existed — this one and `cursor/shared-login-engine-6a0d`
(Lifestyle #17, GEMA #24, Academy #8). Lifestyle #19 merged first, so the
mirrored module is the engine on `main` and the other three were reconciled
into it rather than merged alongside:

- The decision tree moved into `one-account/resolve.ts`, a pure function over
  ports. Cursor's orchestration tests came with it and now cover throttle
  order, the local-mirror fast path, the guild-outage backup, and the
  configuration and unexpected-throw cases.
- `one-account/client.ts` is the browser-safe half of the module; `index.ts`
  stays server-only.
- Staging's **Confirm signup** emails a 6-digit code, not a link. Lifestyle and
  Academy now offer that code step after register and after an unconfirmed
  sign-in. An unconfirmed address does not count against the throttle. GEMA
  keeps link wording — the code is a Staging template, and GEMA is on
  production Auth.
- Academy: Demo Desks gone from the Staging login; a Lifestyle-shaped
  `public.profiles` on Staging now reads as **not enrolled** rather than
  "Academy unavailable".

## Where the proof holds, and where it does not

The 2026-09-03 proof above is a **Preview** proof, and it should be read that
way. Preview deployments load the Preview environment, which points at Staging
`fxdsnacuonfvutdquogb`. That is the environment this Change was written for and
the one it is proven on.

A second pass with a different mirrored username (`testgrinder`, member_code
`OGG-999001`, seeded into `gema.members` on Staging against an existing Auth
user — no migration needed) came out split, and the split is the useful part:

- **Lifestyle** — signs in and lands on the door card. The mirrored path works
  end to end: `gema.members` → auth email → mirrored password, guild API never
  called.
- **GEMA and Academy on `main`-branch URLs** — "Invalid username or password",
  which is the guild's 401 for a username it has never heard of. The mirror
  lookup returned null, so the login escalated to the guild.

Read together with the Preview proof, that is not a contradiction and not an
engine fault. Vercel builds from the **production branch** use **Production**
environment variables, not Preview. GEMA's Production scope points at
production Auth `rvwseybgimmewuoccecu`, where `testgrinder` does not exist;
Lifestyle passes because its Production scope already points at Staging. Same
code, three different projects, two different databases.

Confirm before treating it as settled: on a failing page, the Supabase cookie
`sb-<project-ref>-auth-token` names the project the deployment actually reached,
and `[one-account] identity spine` in Vercel Runtime Logs prints the URL and
schema once per process. Either one names the database; neither exposes a key.

**This does not change Change 2's status.** Shared login is proven on Staging.
Making a Staging username work against production Auth is not this Change's job
and must not be attempted — production Auth is a hard stop, and pointing
Production at Staging is forbidden by [[00 - Locks]].

## Staging facts, confirmed by query

- `gema.profiles`, `gema.members` and `public.profiles` exist. `gema.login_attempts`
  does **not**, so the login throttle is silently off on Staging — the engine
  degrades correctly, but the 5-failures/15-minutes behaviour is unproven there.
  Confirm the table exists in production before assuming brute-force protection
  is live.
- `public.user_roles` and `public.member_rank_progress` are absent. Academy's
  role query fails soft: roles fall back to `[]` and `homePath([])` lands on
  `/academy`, the intended empty training screen.
- **15 auth users, 9 `gema.profiles` rows.** Six accounts can sign in but are
  not people. Change 3 has to reconcile those, not merely backfill.
- `handle_new_user` inserts `gema.profiles` and nothing else — Change 1's claim
  holds at the schema level, not only in the live test.
- `public.profiles` carries a `role text` column. [[03 - Identity model]] forbids
  members writing their own roles; the RLS policies on that table have not been
  read yet. Check before Change 3 touches it.

## Owner steps in

Add to Lifestyle and Academy **Preview** Vercel env, server-only — never `NEXT_PUBLIC_`:

- `ONEGRINDERS_API_KEY` (and optional `ONEGRINDERS_LOGIN_URL`)
- `SUPABASE_SERVICE_ROLE_KEY` for the same Staging project — the username half of
  the login reads the identity spine with it. Email + password works without it.

Until those are set, both spokes sign in by email and refuse a username with
“External login is not configured.”

## Done when

A Staging OneGrinders (or mirrored) username signs into all three apps with the same password. Email admin login still works.

## Next

[[Change 3 - Public profiles]]
