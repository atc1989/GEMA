---
title: Change 1 - Staging identity freeze
aliases:
  - Change 1
tags:
  - gutguard
  - one-account
  - change
---

# Change 1 — Staging identity freeze

**Status:** open · **Current change** on [[One Account]]

Read [[00 - Session gate]] again before writing any SQL or env.

## Goal

One Staging Auth project can serve GEMA, Academy, and Lifestyle without Academy minting a trainee on every signup.

## Target

GutGuard Staging: `fxdsnacuonfvutdquogb`.  
**Not** production `rvwseybgimmewuoccecu`.

## Vault reads for this Change

- [[00 - Session gate]] · [[00 - Locks]] · [[01 - Decisions]] · [[03 - Identity model]]
- Tech Stack: OWNER, Canonical, **Supabase**, **Deploy and Env**
- Design System: skip unless a login screen is edited (it should not be)

## Work

- [x] Academy: rewrite `academy.handle_new_user` so it only ensures a person row. No `user_roles.member`, no BASE progress on Auth insert. Forward migration only. Keep `supabase/migrations/20260813120000_init.sql` immutable.
- [ ] Point Academy and Lifestyle **Preview / local** at the same Staging URL and anon key as GEMA Staging. Service role server-only. *(repo `.env.example` now names Staging; Vercel Preview env is still owner)*
- [x] Lifestyle: when those env vars are set, do not use `localStorage` as authorization.
- [x] Prove with fictional users only:
  - [x] GEMA-style Auth insert → person exists, **zero** Academy BASE / `member_rank_progress` rows
  - [x] Lifestyle register → same `auth.users.id`, Lifestyle-only data if any, no Academy trainee
  - [ ] Same account can sign into Academy afterwards (trainee row is Change 4; for this Change, login must not 500) — in-repo: empty roles and missing catalog no longer 500. Live Preview sign-in waits on the owner Vercel env step.

## Repos

`gentrep-academy` (trigger) · `GutGuard-Life-Style` (env/mock) · `GEMA` (confirm Staging URL only)

## Notes

- Do **not** apply Academy’s schema or this trigger rewrite onto GutGuard Staging. Staging `public.profiles` is Lifestyle-shaped (`name`, `card_no`, points). Colliding it would break the freeze.
- Staging Auth is already person-only: `on_auth_user_created` → `public.handle_new_user()` inserts `gema.profiles` and nothing else. Academy tables are absent there.
- The Academy function rewrite ships in the Academy repo (local / CI, and later when trainee tables are installed without minting BASE).

## Owner steps in

**Now:** copy this `One Account` folder to `C:\Users\najee\Documents\One Account\` so Obsidian is the copy you read.

**When Preview should hit Staging:** set Vercel Preview env on Academy and Lifestyle (`NEXT_PUBLIC_SUPABASE_URL`, anon/publishable key, `NEXT_PUBLIC_SITE_URL`). Do not put service role in `NEXT_PUBLIC_`. Do not point Production at Staging.

## Done when

On Staging, a new Auth user is a person only. Production Auth is untouched. Academy directory is not flooded with GEMA signups.

## Next

[[Change 2 - Shared login engine]]
