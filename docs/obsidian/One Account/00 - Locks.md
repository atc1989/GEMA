---
title: 00 - Locks
tags:
  - gutguard
  - one-account
  - lock
---

# Locks

Every Change inherits these. They are also written onto each Change.

## Identity

| Constraint | Rule |
|---|---|
| Spine | GEMA production Auth is the only real user set. OneGrinders stays the username verifier. |
| Reset | Academy and Lifestyle have no real users. Reset their Auth. Do not merge fake/demo identities into production. |
| Person | One `auth.users.id` = one person row. Same id in every product table. |
| Split | Person ≠ GEMA distributor ≠ Academy trainee ≠ Lifestyle card. |
| Trigger | New Auth user creates a person only. Never auto-enrol Academy BASE or a Lifestyle card. |
| Production | Off limits until Change 1 is proven on Staging. |

## Stack

| Layer | Rule |
|---|---|
| Apps | Three Next.js apps stay. Hub-and-spoke. Do not merge frontends. |
| Lifestyle / Academy | Canonical stack. Portable CSS. **No Tailwind. No shadcn.** No ORM. |
| GEMA | Existing Tailwind/shadcn stays **in GEMA only**. Do not copy it. |
| Auth | Cookie sessions via `@supabase/ssr`. Not `localStorage` as authorization. |
| Secrets | Service role, OneGrinders API key: server / Vercel only. Never `NEXT_PUBLIC_`. |
| Dialects | One dialect per screen. Login skin for new work = Lifestyle commerce/editorial. |

## HCI (when a Change touches UI)

| Constraint | Rule |
|---|---|
| Touch | Minimum **44×44**. |
| Focus | Gold `:focus-visible`. |
| Copy | Uppercase micro-labels. **Gutguard** spelling. |
| Chairman | Academy member dashboard layout/IA stays. Skin with Doctors tokens only. |
