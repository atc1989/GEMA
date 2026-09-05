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

**Status:** **in progress** — cross-app chrome shipped 2026-09-05; Settings is
the item left. 4b and 4c came first by owner decision; Change 6's code also
landed before this, which the Change 6 note records.

Read [[00 - Session gate]] and [[04 - UX]] before this Change. **This Change touches UI — read the Design System.**

## Goal

Lifestyle feels like Gutguard home. Events and Academy are spokes. One Settings for name/mobile.

## Vault reads

- Session gate, Locks, UX
- Tech Stack: OWNER, Canonical, Frontend
- Design System: OWNER, Visual Foundations, Dialects, Portable CSS, Components for nav/buttons
- Academy: chairman HTML stays for `/academy`. Only add a home link, do not restyle the dashboard.

## Work

- [x] Lifestyle sidebar/masthead: Events (GEMA origin), Academy (Academy origin).
  Health / Team / Story unchanged. **No second mobile tab bar** — there is no
  sidebar under 900px, so the two links join the existing account bottom sheet
  instead. Order stays the commerce bottom bar.
- [x] GEMA and Academy: Gutguard home link to the Lifestyle origin. One link
  each, in the account menu; neither dashboard is restyled.
- [ ] Settings: name/mobile on Lifestyle; spokes link there. Lifestyle's
  Settings drawer exists but carries alerts, capsules and QR — no name or
  mobile field yet, so this is real work rather than a link.

## Where the origins come from

Lifestyle already knows the spokes: `NEXT_PUBLIC_GEMA_URL` and
`NEXT_PUBLIC_ACADEMY_URL` are the same values [[Change 4c - One registration]]
builds its `returnTo` allow-list from. One answer in the codebase to "where is
Academy" rather than two that can drift apart.

The spokes did not know the hub, so this Change adds one variable to each:

```
NEXT_PUBLIC_LIFESTYLE_URL     GEMA and Academy — the hub origin
```

**An unconfigured origin renders nothing at all**, never a dead link. That is
the state both spokes are in until `app.gutguard.ph` exists, and it is why the
chrome can ship before the DNS does.

There is a small redundancy worth naming rather than hiding: on Lifestyle,
`NEXT_PUBLIC_SITE_URL` and the hub origin are the same value. Change 4c's
allow-list already uses `SITE_URL`, so nothing was renamed to avoid touching
merged code for tidiness.

## Two naming decisions

**The link is "Events", not "GEMA".** The Lifestyle sidebar already has a GEMA
entry, and it opens a marketing drawer about ranks that unlocks with BASE. That
sells the opportunity; this link opens the events app. Two entries both called
GEMA in one sidebar would be the confusing outcome. The board named it Events
first; the code follows, and a test asserts the label so a later rename has to
be deliberate.

**Academy's wordmark said `GutGuard`.** House spelling is **Gutguard**, capital
G only. Corrected while adding a home link beside it — leaving the two spellings
adjacent would have been worse than the original mistake.

## Dialects used

Lifestyle's member app is the **commerce** dialect per the repo's dialect map,
and the new entries reuse the shell's existing `gg-nav-btn` / `gg-button--secondary`
classes rather than introducing a radius. GEMA keeps Tailwind and shadcn
([[00 - Locks]]), so its link is written in that idiom instead — same behaviour,
same words, two stacks, no cross-contamination.

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
