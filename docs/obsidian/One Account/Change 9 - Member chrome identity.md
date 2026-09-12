---
title: Change 9 - Member chrome identity
aliases:
  - Change 9
tags:
  - gutguard
  - one-account
  - change
---

# Change 9 — Member chrome identity

**Status:** **done** — Staging 2026-09-12, Production Lifestyle `d00488c` the same day.

Gentrep Academy Change 8 stays **CLOSED**. **Current change** on this board is now **none**. Do not invent Change 10 from this note.

Engineering plan: Academy repo `docs/change9-plan.md`.

## Goal

When a signed-in member opens Lifestyle `/app/*` against real Supabase, the shell (masthead / avatar / account sheet / QR) shows that member’s name, sponsor, and minted card from `public.profiles`, using the same metadata fallback `/card` already uses. Saving name/mobile in Settings updates the chrome. The client session stays a **guest** session whenever Supabase is configured.

## Why this is Change 9

Academy Changes 1–8 (streamline + Production cutover) are done. One Account Changes 1–6b are done. The only named leftover on this board was Change 5’s unfixed chrome (“still says Member”). During Change 8 that leftover was labelled “own Change, not Academy Change 9” so it would not ride the cutover. It is now closed. There is no One Account Change 7 or 8.

Owning repo: **`atc1989/GutGuard-Life-Style`**. Academy and GEMA application code were not in scope.

## Work (implementation session)

- [x] Branch from Lifestyle `origin/main` (Settings name/mobile already there). Do not start from Settings-less `staging` HEAD.
- [x] Server-read `public.profiles` in `app/app/layout.tsx` after `ensureCardForCurrentUser()`. User-scoped client only.
- [x] Pass chrome into `MemberShell` → account card/menu, account sheet, QR overlay.
- [x] `saveProfile` revalidates `/app` layout. Do not revive `localStorage` as authorization.
- [x] Tests T-910–T-922. Staging T-914–T-923 (local Next against Staging Auth; Preview SSO still on). Production read-only T-924.
- [x] No SQL. No `db push`. Did not apply `20260911153100` / `20260911154000`. Did not create Staging `app_roles` / `webhook_events`.

## Proof

- Lifestyle PR [#41](https://github.com/atc1989/GutGuard-Life-Style/pull/41) → `staging` (`eef5160`).
- Lifestyle PR [#42](https://github.com/atc1989/GutGuard-Life-Style/pull/42) → Production `main` (`d00488c`).
- Rollback point: previous Production `main` `6c49daa`.
- Staging fixture `demo.member` restored (name Demo Member, mobile null). No `[TEST] C9` residue.
- Production T-924 used existing disposable `bob@test.com` **read-only**. Name/mobile were not written.

## Non-goals (still out of scope)

Academy training features, GEMA, cookies/Auth/domains, Production operator provisioning, Production Academy events catalog, Health/Team/Story content hydration, Bien `/admin`.

## Owner steps in

Copy this folder to Najee’s vault when convenient. Staging Preview still needs Vercel SSO for hosted Preview clicks; Change 9 Staging proof used local Lifestyle against Staging Auth, same method as Change 8.

## Done when

A Staging member with a filled `public.profiles` row sees their name and card on `/app/*` chrome (not `"Member"` / empty QR), Settings save updates that chrome, guest-lock tests still pass, `/card` still matches, spokes still open signed-in. Then the same read-only proof on Production Lifestyle.

**Met 2026-09-12.**

## Next

Do not invent Change 10 from this note. Re-read the board. Current change is none.
