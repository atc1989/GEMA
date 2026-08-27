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

**Status:** done on Staging · 2026-08-27

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
- [x] Point Academy and Lifestyle **Preview / local** at the same Staging URL and anon key as GEMA Staging. Service role server-only. *(Preview hit Staging in live proof. Do not point Production at Staging.)*
- [x] Lifestyle: when those env vars are set, do not use `localStorage` as authorization.
- [x] Prove with fictional users only:
  - [x] GEMA-style Auth insert → person exists, **zero** Academy BASE / `member_rank_progress` rows
  - [x] Lifestyle register → same `auth.users.id`, Lifestyle-only data if any, no Academy trainee
  - [x] Same account can sign into Academy afterwards (trainee row is Change 4; for this Change, login must not 500) — Lifestyle door card, then Academy **You're signed in** / training not enrolled yet.

## Repos

`gentrep-academy` (trigger) · `GutGuard-Life-Style` (env/mock) · `GEMA` (confirm Staging URL only)

## Notes

- Do **not** apply Academy’s schema or this trigger rewrite onto GutGuard Staging. Staging `public.profiles` is Lifestyle-shaped (`name`, `card_no`, points). Colliding it would break the freeze.
- Staging Auth is already person-only: `on_auth_user_created` → `public.handle_new_user()` inserts `gema.profiles` and nothing else. Academy tables are absent there.
- The Academy function rewrite ships in the Academy repo (local / CI, and later when trainee tables are installed without minting BASE).
- Staging **Confirm signup** currently emails GEMA’s partner **6-digit code**, not a confirmation link. Lifestyle and Academy accept that code on the register/sign-in screens. Do not type the code into the password field. Production Auth templates stay untouched.
- Production Auth (`rvwseybgimmewuoccecu`) was not written.

## Owner steps in

Copy this `One Account` folder to `C:\Users\najee\OneDrive\Documents\GutGuard\One Account\` so Obsidian is the copy you read.

## Done when

On Staging, a new Auth user is a person only. Production Auth is untouched. Academy directory is not flooded with GEMA signups.

**Met on Staging Preview, 2026-08-27.**

## Next

[[Change 2 - Shared login engine]] — next on the board. Do not start until the owner says go.
