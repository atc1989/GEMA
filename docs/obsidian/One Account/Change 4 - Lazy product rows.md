---
title: Change 4 - Lazy product rows
aliases:
  - Change 4
tags:
  - gutguard
  - one-account
  - change
---

# Change 4 — Lazy product rows

**Status:** **current**. [[Change 3 - Public profiles]] closed on Staging 2026-09-04.

Read [[00 - Session gate]] and [[03 - Identity model]] before this Change.

## Goal

First Lifestyle visit creates the card/member row. First Academy visit creates the trainee row. GEMA `members` stay OneGrinders/onboard/convert only. No 431-row eager backfill.

## Vault reads

- Session gate, Locks, Decisions, Identity, UX
- Tech Stack: OWNER, Canonical, Supabase
- Design System: skip unless a first-visit empty state is new UI

## Work

- [ ] Lifestyle: on authenticated visit, if no Lifestyle row, insert defaults from `public.profiles` (name, new card, phase invited, 0 points).
- [ ] Academy: on authenticated visit, if no trainee/progress, create Academy-local row + member role + BASE **open**. Not completed.
- [ ] GEMA signup / OneGrinders still must not call those inserts (already forbidden in Change 1–2).
- [ ] Ginhawa register: Auth + person + Lifestyle row only.
- [ ] A OneGrinders member opening Lifestyle gets a card built from their guild
  name, without ever seeing the register form (D13).

## Owner steps in

None on Staging. Production backfill is not this Change.

## Done when

OneGrinders Staging user opens Lifestyle and gets a card without registering. Academy stays empty until they open `/academy`.

## Next

[[Change 5 - Hub chrome]]
