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
