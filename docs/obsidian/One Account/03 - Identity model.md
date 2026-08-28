---
title: 03 - Identity model
tags:
  - gutguard
  - one-account
---

# Identity model

```text
auth.users.id
    └── profiles          ← GutGuard person (name, email, phone, avatar)
            ├── lifestyle member row   card, phase, claimed, points
            ├── gema.members           username, member_code, sponsor, rank
            └── academy trainee row    member_card, current_rank, team
```

**Person** starts as today’s `gema.profiles` (same UUID as Auth). Change 3 copies identity columns to `public.profiles` with the **same ids**. GEMA keeps a compatibility path until its clients stop reading identity from the `gema` schema.

`gema.members` is created only by existing OneGrinders / onboard / convert paths — not by Lifestyle register, not by Academy login.

Academy `handle_new_user` today inserts profile + `member` role + BASE progress. That is forbidden after Change 1. Replacement: person row only.

Roles stay product-scoped. GEMA `admin` is not Academy `admin`. Members must not write their own roles (not on a self-update profile column, not in `user_metadata`).
