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

**Status:** open · **Current change** on [[One Account]]. Engine shipped in all three repos 2026-08-28; the Staging proof waits on the owner env step. [[Change 1 - Staging identity freeze]] closed on Staging 2026-08-28.

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
- [ ] Prove on Staging: one OneGrinders username signs into Lifestyle, GEMA, and Academy with the same password, and an email admin login still works. *(waits on the owner env step below)*

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
