---
title: Change 5 - Hub chrome
aliases:
  - Change 5
tags:
  - gutguard
  - one-account
  - change
---

# Change 5 — Hub chrome

**Status:** blocked on [[Change 4 - Lazy product rows]]

Read [[00 - Session gate]] and [[04 - UX]] before this Change. **This Change touches UI — read the Design System.**

## Goal

Lifestyle feels like Gutguard home. Events and Academy are spokes. One Settings for name/mobile.

## Vault reads

- Session gate, Locks, UX
- Tech Stack: OWNER, Canonical, Frontend
- Design System: OWNER, Visual Foundations, Dialects, Portable CSS, Components for nav/buttons
- Academy: chairman HTML stays for `/academy`. Only add a home link, do not restyle the dashboard.

## Work

- [ ] Lifestyle sidebar/masthead: Events (GEMA origin), Academy (Academy origin). Keep Health / Team / Story. Do not add a second mobile tab bar; Order stays the commerce bottom bar.
- [ ] GEMA and Academy: Gutguard home link to Lifestyle origin.
- [ ] Settings: name/mobile on Lifestyle; spokes link there.

### One registration (D13)

Account registration is already Lifestyle-only — Academy has no sign-up form,
and GEMA's `/register/<event>` is Ginhawa prospect capture, not account
creation. So this is finishing the seam, not removing pages.

- [ ] Lifestyle `/register` accepts `?returnTo=` (same-origin or a known spoke
  origin only) and sends the member there after the confirm code, instead of
  always landing on the door card.
- [ ] Lifestyle register offers "Already a OneGrinders member? Sign in with your
  username" and routes an identifier with no `@` to sign-in rather than
  creating a second account.
- [ ] Academy and GEMA login pages link to Lifestyle register with `returnTo`.
  Neither grows a form of its own.
- [ ] Leave Ginhawa `/register/<event>` alone. It captures a prospect and a
  sponsor `ref`; the Auth user is minted at conversion, not here.

## Owner steps in

Confirm public origins for Staging/Preview links (`NEXT_PUBLIC_SITE_URL` per app).

## Done when

A Staging member can move hub → spoke → hub without a second register. Chairman Academy layout unchanged.

## Next

[[Change 6 - Shared domain SSO]]
