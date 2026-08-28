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

**Status:** open · **Current change** on [[One Account]]. [[Change 1 - Staging identity freeze]] closed on Staging 2026-08-28.

Read [[00 - Session gate]] before this Change.

## Goal

Username or email + password behaves the same on Lifestyle, GEMA, and Academy. OneGrinders is the username verifier everywhere.

## Vault reads

- Session gate, Locks, Decisions, Architecture, UX
- Tech Stack: OWNER, Canonical, Supabase, Frontend, Deploy
- Design System: OWNER, Visual Foundations, Dialects, Portable CSS — **if** login UI is touched

## Work

- [ ] Extract GEMA login behavior (OneGrinders local-first, API, backup, email password, `redirectTo`, throttle) into a portable module. Do not copy Tailwind.
- [ ] Lifestyle and Academy call that behavior. Identifier field: “Username or email”.
- [ ] OneGrinders provisioner still writes GEMA profile/member as today. It must **not** write Academy BASE or Lifestyle cards (Change 4).
- [ ] `ONEGRINDERS_API_KEY` server-only on any app that hosts login.

## Owner steps in

Add `ONEGRINDERS_API_KEY` (and optional `ONEGRINDERS_LOGIN_URL`) to Lifestyle and Academy **Preview** Vercel env, server-only. Not needed until this Change starts.

## Done when

A Staging OneGrinders (or mirrored) username signs into all three apps with the same password. Email admin login still works.

## Next

[[Change 3 - Public profiles]]
