# GEMA

Events, business, and commissions. Holds the **real** users: production Auth `rvwseybgimmewuoccecu` (~431 accounts, mostly OneGrinders). Auth: OneGrinders username, or email + password.

# One Account — read before every identity / auth / profile move

This repo is a **spoke**, and it is the identity spine. Shared login lives on GEMA Auth + OneGrinders. Lifestyle is the hub.

**Every session, before every task, and after every task:**

1. Read `docs/obsidian/One Account/00 - Session gate.md`
2. Read `docs/obsidian/One Account/One Account.md` and confirm **Current change**
3. Read that Change note only
4. Then the Tech Stack gate below
5. After the task: re-read the board. Do not invent the next step. Do not skip Changes.

Canonical Obsidian drop: `C:\Users\najee\Documents\One Account\`
Do **not** edit `GutGuard Tech Stack/` or `GutGuard Design System/`.

# Stack gate

Before changing app architecture, data, auth, deploy, or dependencies:

1. Read the Obsidian GutGuard Tech Stack — **READ ONLY**. Do not edit that vault or the Design System vault.
2. Minimum reads: `00 - OWNER — Read only`, `00 - GutGuard Tech Stack`, `01 - Canonical Stack`, `02 - Supabase Conventions`, `04 - Deploy and Env`, plus `03 - Frontend Conventions` for app code.
3. **GEMA keeps its existing Tailwind + shadcn UI — in GEMA only.** Do not copy it into Lifestyle or Academy; those two are portable-CSS repos. See `docs/obsidian/One Account/00 - Locks.md`.
4. Supabase Auth + Postgres + RLS, no ORM. Vercel + npm + ESLint.
5. Service role keys and `ONEGRINDERS_API_KEY`: server / Vercel only — never `NEXT_PUBLIC_`.

# Hard stops

- Production Auth `rvwseybgimmewuoccecu` is the only real user set. Do not migrate it, and do not point Production at Staging (`fxdsnacuonfvutdquogb`).
- One `auth.users.id` = one person row. A new Auth user creates a person only — never an Academy BASE row or a Lifestyle card.
- Do not merge the three Next.js apps.
- House spelling in UI copy: **Gutguard** (capital G only).
