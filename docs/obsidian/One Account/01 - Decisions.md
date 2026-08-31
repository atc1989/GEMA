---
title: 01 - Decisions
tags:
  - gutguard
  - one-account
---

# Decisions

Frozen. Do not re-litigate inside a Change. If a Change needs a different rule, stop and ask the owner.

| ID | Decision |
|---|---|
| D1 | **Lifestyle is the hub.** GEMA (events, business, commissions) and Gentrep Academy (training) sit under it. |
| D2 | **One account for all is the priority.** Same credentials open all three apps. |
| D3 | **GEMA Auth is generalized.** Username → OneGrinders; email → Supabase password. Local password mirror and backup stay. |
| D4 | **Keep the real users.** Production project `rvwseybgimmewuoccecu` (~431 Auth users, mostly OneGrinders). Do not migrate them onto a new Auth project. |
| D5 | **Reset Academy and Lifestyle Auth.** No real users there. Do not merge demo/`gentrep.test`/mock cards into production. |
| D6 | **Staging first.** GutGuard Staging `fxdsnacuonfvutdquogb`. Never Change-1 against production. |
| D7 | **Hub-and-spoke apps.** Three Vercel projects. Shared Auth. Do not merge into one Next.js tree. |
| D8 | **Lazy product rows.** Do not eager-create 431 door cards or Academy trainees. First visit to a spoke creates that spoke’s row. |
| D9 | **Ginhawa register may create an email account** on the shared Auth. It must not require a OneGrinders username. OneGrinders members must not fill Ginhawa register again. |
| D10 | **Prospects without login stay prospects** until convert or OneGrinders. |
| D11 | **v1 session** = same password on each origin. Parent-domain cookies = Change 6. |
| D13 | **One registration.** Account creation lives on Lifestyle only. Spokes never grow a sign-up form; they link to Lifestyle register and send the member back where they started. A OneGrinders member never registers at all — the guild username *is* the account. Product registration is not account registration: a Ginhawa event seat is booked in GEMA and stays there. |
| D12 | **Dashboard rename** of `rvwseybgimmewuoccecu` from “GutGuard Life Style” to “GutGuard Identity” (or Production) is owner-only and can wait. |

Recorded 2026-08-27 from owner direction: Lifestyle main, GEMA Auth + OneGrinders generalized, Academy/Lifestyle reset ok, one account first.
