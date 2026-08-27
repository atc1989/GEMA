---
title: Change 6 - Shared domain SSO
aliases:
  - Change 6
tags:
  - gutguard
  - one-account
  - change
---

# Change 6 — Shared domain SSO

**Status:** blocked on [[Change 5 - Hub chrome]]

Read [[00 - Session gate]] and Tech Stack **Deploy and Env** before this Change.

## Goal

One browser session across Lifestyle, GEMA, and Academy via a parent cookie domain. Not a custom JWT.

## Target shape

```text
app.…        Lifestyle
events.…     GEMA
academy.…    Academy
cookie domain = .parent
```

## Work

- [ ] Custom domains on one parent. Auth redirect allow-list: all three production + preview URLs on the **one** Auth project.
- [ ] Supabase SSR cookies set for the parent domain.
- [ ] Sign out on the hub signs out everywhere.

## Owner steps in

**Required.** DNS, Vercel domains, Supabase Auth URL allow-list, production cutover decision. Agent must not attach production custom domains without the owner.

## Done when

A OneGrinders member signs into Lifestyle and opens GEMA/Academy without typing the password again.

## After this board

Production cutover of Lifestyle/Academy env to `rvwseybgimmewuoccecu` is a **new Change**, not implied here. Ask the owner.
