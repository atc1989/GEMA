---
title: Change 6b - Staging on the real domain
aliases:
  - Change 6b
  - Staging domains
tags:
  - gutguard
  - one-account
  - change
---

# Change 6b — Staging on the real domain

**Status:** **done** — the domains serve `staging`, and One Account was
proven on them 2026-09-07. Opened the same day from a failed test of
[[Change 6 - Shared domain SSO]] that turned out not to be a Change 6 fault.

Read [[00 - Session gate]] and [[00 - Locks]] before this Change.

## Why this exists

`gutguard.ph` was registered and the three subdomains attached:

```text
lifestyle.gutguard.ph    Lifestyle (hub)
gema.gutguard.ph         GEMA
gentrep.gutguard.ph      Academy       — note: gentrep, not academy
```

Change 6's code was then switched on and **one session did not work**. It was
not a Change 6 bug. Change 6 works.

## What the evidence actually showed

`document.cookie` on `lifestyle.gutguard.ph`, signed in, returned **two** auth
cookies:

```text
sb-fxdsnacuonfvutdquogb-auth-token    Staging      atcoriginalnew@gmail.com
sb-rvwseybgimmewuoccecu-auth-token    Production   bob@test.com
```

A cookie written by one subdomain being readable on another proves the parent
`Domain=.gutguard.ph` is set. **The shared cookie is working.** What is broken
is that the apps behind those subdomains talk to *different Supabase projects*,
so a token signed by Staging means nothing to an app reading Production. Not
"logged out" — holding a credential for the wrong building.

## The root cause: a custom domain serves Production

Vercel serves a custom domain from the **Production** deployment unless the
domain is assigned to a git branch. All the Staging configuration lives on
**Preview**. So:

| | |
|---|---|
| GEMA, Academy | Production env → production Auth `rvwseybgimmewuoccecu` |
| Lifestyle | **no Supabase vars on Production at all** → the `localStorage` mock |
| `NEXT_PUBLIC_ACADEMY_URL` | Preview only → absent from the Production build, so the Academy nav link omitted itself |
| `NEXT_PUBLIC_ONE_ACCOUNT_COOKIE_DOMAIN` | Production only |

The last two are the sharpest detail: **the variable that turns shared sessions
on and the variable that names Academy were scoped to opposite environments.**
No value of either could have made the test pass.

Lifestyle silently running on the mock is the same hazard
[[00 - Session gate]] names — *"stop using mock as authorization"*. It looks
like a working login and creates no session at all.

## The decision

**The three domains point at a `staging` branch, not Production, until One
Account is proven.**

Putting Staging Supabase values on Production is forbidden by [[00 - Locks]].
Putting Lifestyle and Academy onto production Auth is the **production
cutover** — a separate Change needing the owner, per
[[Change 6 - Shared domain SSO]]. Neither is a thing to do in order to fix a
test.

## Work

- [x] `staging` branch in all three repos, from `main`.
- [x] **Owner: assign each domain to branch `staging`** — Vercel → Settings →
  Domains → the domain row → Edit → Git Branch → `staging`. Do not remove and
  re-add the domain; that drops DNS verification.
- [x] **Owner: add `NEXT_PUBLIC_ONE_ACCOUNT_COOKIE_DOMAIN=gutguard.ph` to
  Preview** in all three projects. It is Production-only today.
- [x] **Owner: Lifestyle — repoint the Pre-Production `NEXT_PUBLIC_SITE_URL`**
  from the old `…vercel.app` value to `https://lifestyle.gutguard.ph`.
- [x] **Owner: redeploy all three with the build cache OFF.** `NEXT_PUBLIC_*`
  is inlined at build time and a cached build reuses the old values.
- [x] **Owner: clear cookies for `gutguard.ph`** before retesting. Two
  conflicting sessions are sitting there, one of them a real production account.

Everything else already on Preview is correct: Supabase keys, `GEMA_URL`,
`ACADEMY_URL`, `LIFESTYLE_URL`, service role, OneGrinders.

## A branch with no commit of its own gets no deployment

`staging` was first pushed at the same SHA as `main`. Vercel had already built
that commit and deduplicated, so no deployment appeared and the domain had
nothing to point at. This note is the commit that gives the branch its own
deployment — recorded because it looks exactly like the Git integration being
broken, and it is not.

## What made it pass

The domain edit is not a "Git Branch" text field any more. Vercel's Domains
panel offers **Connect to an environment**, and the domain is pointed at
**Preview** there. Written down because the older instructions everywhere
describe a field that no longer exists.

Also worth keeping: an incognito window is a better way to start this test than
clearing cookies by hand. There is nothing to forget to clear.

## Done when

A member signs in on `lifestyle.gutguard.ph` and opens `gema.gutguard.ph` and
`gentrep.gutguard.ph` without typing a password again, with all three serving
the `staging` branch against Staging Auth `fxdsnacuonfvutdquogb`.

## Next

The production cutover — moving the domains back to Production with all three
apps on `rvwseybgimmewuoccecu` — is its own Change and needs the owner. It is
not implied by this one.
