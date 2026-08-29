---
title: Change 3 - Public profiles
aliases:
  - Change 3
tags:
  - gutguard
  - one-account
  - change
---

# Change 3 — Public profiles

**Status:** blocked on [[Change 2 - Shared login engine]]

Read [[00 - Session gate]] and [[03 - Identity model]] before this Change.

## Goal

One person table at `public.profiles` with **the same UUIDs** as `auth.users` / existing `gema.profiles`. Lifestyle and Academy read it. GEMA keeps working.

## Vault reads

- Session gate, Locks, Decisions, Identity model
- Tech Stack: OWNER, Canonical, **Supabase** (RLS, views `security_invoker`)
- Design System: skip

## Work

- [ ] Staging only: `public.profiles` identity columns (name, email, phone, avatar, locale, timezone, status, last_seen). Same ids as Auth.
- [ ] Backfill from `gema.profiles`. Do not drop `gema.profiles` until GEMA has a compatibility view or a public identity client.
- [ ] RLS: own row read/update except status. Status via security-definer / admin only.
- [ ] Lifestyle and Academy read `public.profiles` for name/email/mobile. Stop treating a wide Lifestyle `profiles` as the person if those columns still mix card/points — split is Change 4.

## Owner steps in

None unless Staging SQL must be applied in the dashboard by hand. Agent uses Staging MCP/SQL, not production.

## Done when

Same id is the person in GEMA and in `public.profiles` on Staging. GEMA member dashboard still loads.

## Next

[[Change 4 - Lazy product rows]]
