---
title: 00 - Session gate
aliases:
  - Session gate
  - Read this first
tags:
  - gutguard
  - one-account
  - lock
---

# Session gate

**Read this file at the start of every session, before every task, and again after every task.** Do not implement from memory. Do not invent the next step.

Drop path on Najee’s machine:

`C:\Users\najee\OneDrive\Documents\GutGuard\One Account\`

Product-repo copies live at `docs/obsidian/One Account/` in GEMA, Gentrep Academy, and GutGuard Lifestyle.

## Never edit these vaults

- `GutGuard Tech Stack/` — owner only
- `GutGuard Design System/` — owner only

Implement only in product repos. This `One Account/` folder is the changes board, not those two vaults.

## Every move — in this order

1. Open [[One Account]] and confirm **Current change**.
2. Read this gate.
3. Read [[00 - Locks]] and [[01 - Decisions]].
4. Read the current Change note (and only that Change).
5. **Tech Stack** (always, because this board is auth/data/deploy):
   - `GutGuard Tech Stack/00 - OWNER — Read only`
   - `GutGuard Tech Stack/00 - GutGuard Tech Stack`
   - `GutGuard Tech Stack/01 - Canonical Stack`
   - `GutGuard Tech Stack/02 - Supabase Conventions`
   - `GutGuard Tech Stack/04 - Deploy and Env`
   - plus `03 - Frontend Conventions` if the Change touches app code
6. **Design System** (only if the Change touches UI):
   - `GutGuard Design System/00 - OWNER — Read only`
   - `GutGuard Design System/00 - GutGuard Design System`
   - `GutGuard Design System/01 - Visual Foundations`
   - `GutGuard Design System/Foundations/Dialects`
   - `GutGuard Design System/03 - Portable CSS Starter`
   - component notes for anything you render
7. Then implement **in the product repo named by the Change**. Check the Change box only after the vault reads for that kind of work are done.

## After every task

Re-read [[One Account]] and the current Change note. Confirm:

- what actually shipped vs what the Change still requires
- **Current change** has not been skipped
- the next move is the next unchecked item on this board — not a new idea

If a task finishes a Change, mark it done here, then stop and re-read before starting the next Change.

If the Tech Stack or Design System note and this board disagree, **stop** and ask the owner. Do not improvise a third rule.

## Hard stops

- Do not skip to a later Change while an earlier one is open.
- Do not touch production Auth (`rvwseybgimmewuoccecu`, ~431 real users) until Change 1 is proven on Staging.
- Do not merge the three Next.js apps.
- Do not copy GEMA Tailwind/shadcn into Academy or Lifestyle.
- Do not put Lifestyle points or Academy ranks on the shared person row.
- Do not let Academy’s new-user trigger mint BASE on a GEMA or Lifestyle signup.
- House spelling in UI: **Gutguard** (capital G only).
