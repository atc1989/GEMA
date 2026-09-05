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

**Status:** blocked on [[Change 4b - Academy on Staging]] and [[Change 4c - One registration]], both taken before this Change by owner decision.

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

### One registration

Split out on 2026-09-05 into [[Change 4c - One registration]], which comes
before this Change. A nav bar and a cross-origin auth redirect are unlike risks
and want separate proofs. This Change is chrome only.

## Owner steps in

Confirm public origins for Staging/Preview links (`NEXT_PUBLIC_SITE_URL` per app).

## Done when

A Staging member can move hub → spoke → hub without a second register. Chairman Academy layout unchanged.

## Next

[[Change 6 - Shared domain SSO]]
