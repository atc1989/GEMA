---
title: Change 5 - Hub chrome
aliases:
  - Change 5
tags:
  - gutguard
  - one-account
  - change
---

# Change 5 — Hub chrome

**Status:** **done** — the chrome was proven on the real domain 2026-09-07, and Settings
name/mobile landed the same day. 4b and 4c came first by owner decision; Change 6's code also
landed before this, which the Change 6 note records.

Read [[00 - Session gate]] and [[04 - UX]] before this Change. **This Change touches UI — read the Design System.**

## Goal

Lifestyle feels like Gutguard home. Events and Academy are spokes. One Settings for name/mobile.

## Vault reads

- Session gate, Locks, UX
- Tech Stack: OWNER, Canonical, Frontend
- Design System: OWNER, Visual Foundations, Dialects, Portable CSS, Components for nav/buttons
- Academy: chairman HTML stays for `/academy`. Only add a home link, do not restyle the dashboard.

## Work

- [x] Lifestyle sidebar/masthead: Events (GEMA origin), Academy (Academy origin).
  Health / Team / Story unchanged. **No second mobile tab bar** — there is no
  sidebar under 900px, so the two links join the existing account bottom sheet
  instead. Order stays the commerce bottom bar.
- [x] GEMA and Academy: Gutguard home link to the Lifestyle origin. One link
  each, in the account menu; neither dashboard is restyled.
- [x] Settings: name/mobile on Lifestyle; spokes link there. The drawer carried
  alerts, capsules and QR and no identity field at all, so this was real work
  rather than a link. `SettingsIdentity` in `components/overlays/MemberOverlays.tsx`,
  `loadProfile()` / `saveProfile()` in `lib/actions/member.ts`, `profileSchema`
  in `lib/schemas/settings.ts`.

## What Settings actually needed, and why it is not two inputs

**The drawer cannot read the member off `session`.** With Supabase configured,
`parseLifestyleSession` returns a *guest* session on purpose — `name`, `mobile`
and `cardNo` are empty strings, and `lib/session-state.test.ts` pins that so a
leftover mock session cannot survive Supabase being on. Nothing hydrates the
client session from `public.profiles`. So the drawer owns its own state: it
mounts when the drawer opens, reads the row once, and writes it back.

**Both fields are required, on the owner's call (2026-09-07).** A member cannot
save a name and leave the mobile blank — the same bar register sets. The rules
are register's own, reused rather than restated, so the two forms cannot drift
into disagreeing about what a name or a PH number is.

**The unique index is a user-facing error path, not an edge case.**
`profiles_mobile_uidx` is unique on `public.profiles(mobile)`, so editing to a
number someone else holds raises `23505`. That is mapped to the existing
`MOBILE_TAKEN` copy on the mobile field; without the mapping a member would read
a raw Postgres string.

Two things this deliberately did **not** do: it writes `name` and `mobile` only,
because the `profiles_sync_identity` trigger mirrors them onto `full_name` and
`phone` and writing those too would fight it; and it uses the member's own
session client, not the admin client, because Change 3's column grant list
already includes both columns.

## Mobile format widened — PH only, still

`639171234567` was rejected before this; `09171234567` and `+639171234567` were
not. Owner's call: all three are the same number and all three are accepted, and
nothing outside the Philippines is. The regex was the smaller half —
`toE164Phone` assumed anything without a `+63` prefix was the `09…` form and
sliced one character off the front, which would have turned a bare `639…` into
`+6339171234567`. Both changed together, in `lib/schemas/auth.ts`.

No SQL. `lifestyle_identity_taken()` only ever sees the schema's normalized
`+639…` output, and its own `+63%` ↔ `09%` branches already cover that.

## Proven, 2026-09-07

`npm test` (113 pass), `tsc --noEmit`, `eslint` and `next build` all clean, then
the drawer driven in the browser with Supabase env empty: `639171234567` saved
as `+639171234567`, `+14155550123` refused with "Enter a valid PH mobile
number", a blank mobile refused, and the previously saved values left intact by
both refusals.

The Supabase path — reading the row, and the duplicate-mobile collision — is
proven by construction and by the schema tests, **not** on Staging. That is the
one thing left to confirm on `lifestyle.gutguard.ph`.

## Found while doing this — not fixed here

**The member chrome shows "Member", not the member.** Because the client session
is a guest session whenever Supabase is on, the masthead and avatar render
`memberDisplayName("")` → "Member", and `QRBlock` gets an empty `seed` even
though Change 4 mints a real card number. Saving a name in Settings therefore
does **not** change the masthead. The fix is to read the profile in the server
component `app/app/layout.tsx`, which already calls `ensureCardForCurrentUser()`,
and pass it into `MemberShell`.

**Fixed by [[Change 9 - Member chrome identity]]** (done 2026-09-12).

## Where the origins come from

Lifestyle already knows the spokes: `NEXT_PUBLIC_GEMA_URL` and
`NEXT_PUBLIC_ACADEMY_URL` are the same values [[Change 4c - One registration]]
builds its `returnTo` allow-list from. One answer in the codebase to "where is
Academy" rather than two that can drift apart.

The spokes did not know the hub, so this Change adds one variable to each:

```
NEXT_PUBLIC_LIFESTYLE_URL     GEMA and Academy — the hub origin
```

**An unconfigured origin renders nothing at all**, never a dead link. That is
the state both spokes are in until `app.gutguard.ph` exists, and it is why the
chrome can ship before the DNS does.

There is a small redundancy worth naming rather than hiding: on Lifestyle,
`NEXT_PUBLIC_SITE_URL` and the hub origin are the same value. Change 4c's
allow-list already uses `SITE_URL`, so nothing was renamed to avoid touching
merged code for tidiness.

## Two naming decisions

**The link is "Events", not "GEMA".** The Lifestyle sidebar already has a GEMA
entry, and it opens a marketing drawer about ranks that unlocks with BASE. That
sells the opportunity; this link opens the events app. Two entries both called
GEMA in one sidebar would be the confusing outcome. The board named it Events
first; the code follows, and a test asserts the label so a later rename has to
be deliberate.

**Academy's wordmark said `GutGuard`.** House spelling is **Gutguard**, capital
G only. Corrected while adding a home link beside it — leaving the two spellings
adjacent would have been worse than the original mistake.

## Dialects used

Lifestyle's member app is the **commerce** dialect per the repo's dialect map,
and the new entries reuse the shell's existing `gg-nav-btn` / `gg-button--secondary`
classes rather than introducing a radius. GEMA keeps Tailwind and shadcn
([[00 - Locks]]), so its link is written in that idiom instead — same behaviour,
same words, two stacks, no cross-contamination.

Identity in that chrome (name / avatar / QR) is [[Change 9 - Member chrome identity]]
(**done** 2026-09-12), not a rider on this Change.

### One registration

Split out on 2026-09-05 into [[Change 4c - One registration]], which comes
before this Change. A nav bar and a cross-origin auth redirect are unlike risks
and want separate proofs. What is left here is the chrome and Settings.

## Owner steps in

Confirm public origins for Staging/Preview links (`NEXT_PUBLIC_SITE_URL` per app).

## Done when

A Staging member can move hub → spoke → hub without a second register. Chairman Academy layout unchanged.

## Next

[[Change 6 - Shared domain SSO]]
