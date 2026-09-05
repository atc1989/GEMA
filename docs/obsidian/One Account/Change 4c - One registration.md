---
title: Change 4c - One registration
aliases:
  - Change 4c
  - One registration
tags:
  - gutguard
  - one-account
  - change
---

# Change 4c — One registration

**Status:** planned. Comes after [[Change 4b - Academy on Staging]] and **before**
[[Change 5 - Hub chrome]]. Numbered 4c for the same reason 4b was: so Change 5
and Change 6 keep their numbers and their `[[wikilinks]]`. The number is an
identifier, not a ranking.

Read [[00 - Session gate]], [[01 - Decisions]] and [[04 - UX]] before this Change.
**This Change touches UI — read the Design System.**

## Goal

One place to make an account: Lifestyle `/register`. A member who starts on
GEMA or Academy is sent there and lands back where they started. A OneGrinders
member never registers at all.

Split out of [[Change 5 - Hub chrome]] on 2026-09-05. Change 5 bundled a nav bar
with cross-origin auth redirects; those are unlike risks and deserve separate
proofs. Change 5 keeps the chrome.

## The decision this implements

[[01 - Decisions]] **D13**, frozen 2026-08-27:

> **One registration.** Account creation lives on Lifestyle only. Spokes never
> grow a sign-up form; they link to Lifestyle register and send the member back
> where they started. A OneGrinders member never registers at all — the guild
> username *is* the account. Product registration is not account registration: a
> Ginhawa event seat is booked in GEMA and stays there.

[[04 - UX]] carries the behaviour. Nothing here re-litigates either.

## What exists today, measured 2026-09-05

| | |
|---|---|
| Lifestyle `/register` | Renders `RegisterForm`. Takes no `searchParams`. `signUp()` ends `redirect("/card")` unconditionally. |
| Academy `/login` | No register link, no sign-up form. |
| GEMA `/login` | No register link, no sign-up form. |
| Origins | Each app has `NEXT_PUBLIC_SITE_URL`; Lifestyle already uses it to build the confirm-code email redirect. |

So the good news: **no spoke has a rival sign-up form to remove.** D13 is already
true by omission. What is missing is the seam that makes it usable — a member on
Academy has no way to reach register at all, and no way back.

## The part that is a security surface

`?returnTo=` is an open-redirect vector, and it sits on an authentication flow.
Getting this wrong hands anyone a Gutguard-branded page that bounces a member to
an attacker's origin immediately after they type a password.

Rules, and the reason for each:

- **Allow-list exact origins**, resolved from the three apps'
  `NEXT_PUBLIC_SITE_URL` values plus Lifestyle's own. Compare parsed
  `URL.origin` against that set.
- **Never** substring, `startsWith`, `endsWith`, or a regex on the host.
  `gutguard.ph.attacker.com` passes every one of those.
- **Reject** anything that is not `http`/`https`, and anything with credentials
  (`user:pass@`), so `javascript:` and embedded-auth forms cannot get through.
- **Fall back silently** to the existing `/card` landing on any rejection. A
  member never sees a redirect error; they just land where they always did.
- The allow-list is a pure function, unit tested against the hostile cases
  above, and it lives beside the register action rather than inline in a page.

## Work

- [ ] Lifestyle: a tested `resolveReturnTo()` — exact-origin allow-list, scheme
  check, credentials check, silent fallback to `/card`.
- [ ] Lifestyle `/register` reads `?returnTo=`, carries it through the 6-digit
  confirm step, and lands the member there instead of `/card`.
- [ ] Lifestyle register: "Already a OneGrinders member? Sign in with your
  username." An identifier with no `@` routes to sign-in — it must never create
  a second account. Note `maxDuration = 60` already on that page: a first-time
  guild username waits on the guild API, which stalls ~30s.
- [ ] Academy `/login`: link to Lifestyle register with `returnTo`. No form.
- [ ] GEMA `/login`: same link, same rule. No form.
- [ ] Ginhawa `/register/<event>` untouched. It captures a prospect and a
  sponsor `ref`; the Auth user is minted at conversion (D9, D13).

## What must prove it

- Unit tests on `resolveReturnTo()`: each allowed origin passes; a look-alike
  host, a `javascript:` URL, an embedded-credentials URL, a protocol-relative
  `//evil.com` and a bare path each fall back to `/card`.
- A register with `?returnTo=<academy origin>` lands on Academy after the
  confirm code, not on the door card.
- A guild username typed into register reaches sign-in and creates **no** second
  Auth user — checked by counting `auth.users` before and after.
- Lifestyle, Academy and GEMA still build, lint and pass their suites.

## Owner steps in

Confirm the public origin for each app per environment (`NEXT_PUBLIC_SITE_URL`
on Lifestyle, Academy and GEMA, for Preview and Production). The allow-list is
built from those values, so a wrong or missing one silently disables the
`returnTo` and members land on the door card instead.

## Done when

A member who starts on Academy or GEMA reaches Lifestyle register, finishes, and
lands back where they started — and a OneGrinders member typing their username
into that form is signed in rather than given a second account. Verified by the
owner, not by tests alone.

## Not in this Change

- Hub chrome — nav links, the Gutguard home link, Settings. That is
  [[Change 5 - Hub chrome]].
- Parent-domain cookies. Until [[Change 6 - Shared domain SSO]], each origin
  keeps its own session; `returnTo` moves the member, not the session.

## Next

[[Change 5 - Hub chrome]]
