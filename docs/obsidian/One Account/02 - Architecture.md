---
title: 02 - Architecture
tags:
  - gutguard
  - one-account
---

# Architecture

Hub-and-spoke. See [[01 - Decisions]].

```text
OneGrinders  →  GEMA Supabase Auth  →  one person
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
    Lifestyle      GEMA        Academy
    (HUB)        (spoke)       (spoke)
```

| App | Job | Must work if another app is down |
|---|---|---|
| Lifestyle | Member home, funnel, card, health/team/story | Daily member OS |
| GEMA | Events, QR, tree, commissions, GEMA admin | Door scan at a live event |
| Academy | Ranks, staff, trainer, Lifestyle ops desk | Training night |

All three Preview/Production env vars eventually share one Supabase project. Until Change 1 is done, only **Staging**.

GEMA clients today pin `db: { schema: "gema" }`. Identity will move to `public.profiles` in Change 3. Until then, do not break GEMA product queries.

Shared login is a **module**, not three divergent copies. Source of truth for the engine is GEMA’s OneGrinders path (`src/lib/integrations/onegrinders-login.ts` + `src/lib/actions/auth.ts`). Change 2 ports behavior, not Tailwind.

Do not share: rank catalogs, points vs commissions, Tailwind, chairman HTML.
