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

**Status:** **in progress** — the code half is built and inert (2026-09-05).
Taken before [[Change 5 - Hub chrome]] by owner decision: Change 5 is chrome,
this is not blocked on it, and the DNS half has lead time that runs in
parallel. Recorded here rather than left to look like a skipped Change.

Read [[00 - Session gate]] and Tech Stack **Deploy and Env** before this Change.

## Goal

One browser session across Lifestyle, GEMA, and Academy via a parent cookie domain. Not a custom JWT.

## Target shape

The parent is **`gutguard.ph`**, and two of the three subdomains already exist.
The board previously guessed `events.…` for GEMA; the real one is `gema.…`, and
this note follows reality rather than the other way round.

```text
app.gutguard.ph        Lifestyle   — not yet, owner waiting on GoDaddy DNS access
gema.gutguard.ph       GEMA        — exists
academy.gutguard.ph    Academy     — exists
cookie domain = .gutguard.ph
```

`gutguard.ph` sits directly under `.ph`, so it is registrable and a browser will
accept a cookie on it. `com.ph`, `net.ph` and the rest are public suffixes and
would be rejected **silently** — `guardCookieDomain` refuses those shapes rather
than leaving it to a console nobody reads.

## Work

- [x] Supabase SSR cookies set for the parent domain — `one-account/cookie-domain.ts`,
  mirrored to both spokes, wired into all nine client factories (server,
  middleware/proxy and browser, in each of the three apps). 9 tests.
- [x] Sign out on the hub signs out everywhere — falls out of the shared cookie.
  `@supabase/ssr` also clears the leftover host-only cookie on sign-out once
  `cookieOptions.domain` is set, so the migration does not strand one.
- [ ] **Owner: `app.gutguard.ph` on the Lifestyle Vercel project.** The hub is
  the missing third; see *Why two out of three is worse than none*.
- [ ] **Owner: Auth redirect allow-list** — all three origins on the one
  Staging Auth project `fxdsnacuonfvutdquogb`.
- [ ] **Owner: set `NEXT_PUBLIC_ONE_ACCOUNT_COOKIE_DOMAIN=gutguard.ph`** on all
  three projects, Preview first, and redeploy.

## Why two out of three is worse than none

Lifestyle is the hub: registration and the card live there. Turning this on for
GEMA and Academy alone would let a member cross between the two spokes freely
and then meet a login wall going *home* — a worse experience than three
consistent logins. All three, or none.

## How it is off until it is on

One variable, `NEXT_PUBLIC_ONE_ACCOUNT_COOKIE_DOMAIN`. Unset, every call site
receives `undefined` for `cookieOptions` and behaves exactly as it did before
this Change. There is no second switch and no per-app flag: three apps
disagreeing about a cookie's Domain is the failure this is meant to avoid.

It is `NEXT_PUBLIC_` on purpose. The browser client writes these cookies too; a
server-only variable would leave the server writing `.gutguard.ph` and the
browser writing host-only, giving two cookies of one name and no rule about
which wins. A cookie Domain is visible in devtools — there is nothing secret in
it. This is the one documented exception to the `NEXT_PUBLIC_` rule in the
stack gate, which is about **secrets**.

## Also read as build-time inlining

`process.env.NEXT_PUBLIC_*` is inlined by Next only where it is written as a
literal member expression. `configuredCookieDomain` therefore reads it as a
default parameter and never as `env[key]` — a lookup is not rewritten, so the
browser half would read `undefined` and the feature would quietly half-work.
The comment saying so is in the file; do not "tidy" it into a lookup.

## Changing this on Production

Existing sessions hold host-only cookies. The browser keeps sending them, so
members are **not** signed out at the moment of the change, and the leftover is
cleared on their next sign-out. It is still a scope change on live sessions, and
GEMA Production carries ~431 of them. Staging first; Production is its own
Change with the owner, per [[00 - Locks]].

## Owner steps in

**Required, and the only thing left.** DNS for `app.gutguard.ph`, the Vercel
custom domain on the Lifestyle project, the Supabase Auth URL allow-list, and
the production cutover decision. The agent must not attach production custom
domains without the owner.

## Done when

A OneGrinders member signs into Lifestyle and opens GEMA/Academy without typing the password again.

## After this board

Production cutover of Lifestyle/Academy env to `rvwseybgimmewuoccecu` is a **new Change**, not implied here. Ask the owner.
