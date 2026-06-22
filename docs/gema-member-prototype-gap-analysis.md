# GEMA Member Prototype Gap Analysis

This compares the current Supabase-backed GEMA app with the `gema-member-app`
prototype at `C:\Users\najx\Downloads\gema-member-app-1\gema-member-app`.

## Decision

Do not merge the prototype architecture into this app.

The prototype is a Vite SPA that renders screens from `src/engine.ts` using
HTML strings, global mutable state, inline handlers, seed data, and runtime CDN
dependencies. The current app is the production architecture: Next.js App
Router, route groups, server components/actions, Supabase auth/RLS, schemas,
and typed feature modules.

Use the prototype only as a visual and interaction reference.

## Route Coverage

| Prototype area | Current route/component | Status |
| --- | --- | --- |
| Member Today dashboard | `src/app/(member)/dashboard/page.tsx` | Implemented with real data |
| Member Events: All/My Events/My Passes | `src/app/(member)/member/events/page.tsx`, event detail pages | Partially implemented; no member event creation by design |
| Member No-Zero Calendar | `src/app/(member)/member/calendar/page.tsx` | Implemented as Supabase-backed vertical slice |
| Member Prospects | `src/app/(member)/member/prospects/page.tsx` | Implemented |
| Member Profile | `src/app/(member)/member/settings/page.tsx`, `src/app/(member)/member/referrals/page.tsx` | Split into settings/referrals; prototype profile polish not fully ported |
| Prospect Discover | `src/app/(public)/discover/page.tsx` | Implemented |
| Prospect Events | `src/app/(public)/invite/page.tsx`, `src/app/(public)/invite/[eventId]/page.tsx` | Implemented |
| Prospect Rewards | `src/app/(public)/rewards/page.tsx` | Implemented as static explainer |
| Prospect Passes | `src/app/(public)/passes/page.tsx` | Implemented with real pass lookup |
| Event registration/pass flow | `src/app/(public)/register/[eventId]/page.tsx`, QR components | Implemented with Supabase |
| Admin event creation | `src/app/(admin)/admin/events/new/page.tsx`, `src/components/event/event-form.tsx` | Implemented, but less guided than prototype |
| Attendance/scan | Admin and member event attendance routes | Implemented |
| Rewards/pay-ins/rank polish | Dashboard/earnings/rewards pages | Partially implemented |

## Genuine Product Gaps Worth Porting

1. Member profile hub polish
   The prototype combines identity, referral link, monthly stats, badges,
   recognition, and quick links in one member-facing profile. The current app
   splits account settings and referrals, which is structurally cleaner, but
   lacks the motivational profile surface.

2. Onboarding walkthrough
   The prototype has a short guided onboarding overlay for the No-Zero habit,
   referral link, event pass, and team growth. Current onboarding is account
   setup, not product education.

3. Guided admin event creation
   The current admin event form is functional. The prototype adds name
   templates, event-type presets, venue center/hub pickers, "use me as speaker",
   about-text templates, capacity steppers, and a live poster preview. These
   are good UX candidates, but they should stay admin-only.

4. Public event landing polish
   The prototype's event landing page has stronger poster/banner treatment,
   sticky registration actions, intro video hooks, copy/share actions, and
   guest preview affordances. The current route is real and safer, but less
   polished.

5. Rewards and recognition depth
   The prototype has reward cards, vouchers/modals, rank progress, badges, and
   team recognition. The current app has earnings and public reward explainers,
   but not the same member progress and recognition layer.

6. Prospect list interaction depth
   The current prospect list is read-only. The prototype presents stages and
   follow-up affordances visually. Any port should use real stage update actions
   and audit-safe Supabase writes.

7. Toast/feedback pattern
   The prototype uses lightweight confirmations for copy/share/update flows.
   The current app has many server-action flows but no shared toast pattern.

## Keep Out Of Scope

- Do not import `src/styles/app.css` globally.
- Do not vendor `engine.ts` or `GEMA-Member-Port.reference.jsx`.
- Do not add the prototype Member/Prospect preview toggle.
- Do not duplicate registration, QR, attendance, referrals, or commission logic.
- Do not add member-side event creation unless the role model is explicitly
  changed. Event creation belongs in admin routes today.
- Do not bring in runtime CDN scripts for QR or banner export.

## Suggested Implementation Order

1. Stabilize the new calendar slice:
   fix timezone/day bucketing, use Manila-aware "today" for the Weekly Activity
   Guide, and surface Supabase query errors instead of silently rendering empty
   data.

2. Polish Team Leaderboard:
   add an explicit "no downline yet" state, keep "You" visible, and avoid
   implying weekly ranking when the data is current streak data.

3. Build a member profile hub:
   reuse real member/referral/streak/prospect data, then add badges/recognition
   only when the backing data model is clear.

4. Upgrade admin event creation:
   add templates and guided controls inside the existing admin event form and
   server action, without exposing event creation in member routes.

5. Improve public event landing:
   port visual treatment and sticky actions while preserving existing
   registration and RLS boundaries.

## Current Calendar Notes

The No-Zero Calendar is correctly implemented as a real vertical slice, but the
first cleanup pass should address:

- Event day bucketing should use each event's timezone instead of slicing
  `starts_at` as UTC.
- The Weekly Activity Guide should use the user's/product timezone rather than
  `getUTCDay()`.
- Calendar and leaderboard data builders should handle Supabase errors
  explicitly.
- Leaderboard copy should say "Current streak" or "Team streaks" unless a real
  weekly metric is added.
