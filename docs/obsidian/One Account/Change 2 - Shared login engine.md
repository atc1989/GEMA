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

**Status:** open · **Current change** on [[One Account]]

Read [[00 - Session gate]] before this Change.

## Goal

Username or email + password behaves the same on Lifestyle, GEMA, and Academy. OneGrinders is the username verifier everywhere.

## Vault reads

- Session gate, Locks, Decisions, Architecture, UX
- Tech Stack: OWNER, Canonical, Supabase, Frontend, Deploy
- Design System: OWNER, Visual Foundations, Dialects, Portable CSS — **if** login UI is touched

## Work

- [x] Extract GEMA login behavior (OneGrinders local-first, API, backup, email password, `redirectTo`, throttle) into a portable module. Do not copy Tailwind.
- [x] Lifestyle and Academy call that behavior. Identifier field: “Username or email”.
- [x] OneGrinders provisioner still writes GEMA profile/member as today. It must **not** write Academy BASE or Lifestyle cards (Change 4).
- [x] `ONEGRINDERS_API_KEY` server-only on any app that hosts login.

## Shipped this pass

Portable engine (GEMA is source of truth): `src/lib/one-account/login-engine.ts`, copied to Lifestyle `lib/one-account/` and Academy `src/lib/one-account/`. Provisioner writes `gema.profiles` + `gema.members` only. Academy Demo Desks removed from Staging login. Ginhawa register stays name / mobile / email / password.

## Owner steps in

Add `ONEGRINDERS_API_KEY` (and optional `ONEGRINDERS_LOGIN_URL`) to Lifestyle and Academy **Preview** Vercel env, server-only. Email + password still works without that key. Username login needs it.

## Done when

A Staging OneGrinders (or mirrored) username signs into all three apps with the same password. Email admin login still works.

## Next

[[Change 3 - Public profiles]]
