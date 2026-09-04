---
title: One Account
aliases:
  - One account for all
  - Hub and spoke
tags:
  - gutguard
  - moc
  - one-account
---

# One Account

GutGuard identity board. **Lifestyle is the hub. GEMA and Academy are spokes. One login for all — GEMA Auth plus OneGrinders.**

Canonical folder on Najee’s machine:

`C:\Users\najee\OneDrive\Documents\Obsidian Vault\One Account\`

Copy this whole folder there (not inside Tech Stack, not inside Design System). Cloud agents read the product-repo copy at `docs/obsidian/One Account/`.

**Current change:** [[Change 4b - Academy on Staging]]

Change 1 is checked done — proven on Staging 2026-08-28, production Auth untouched.  
Change 2 is checked done — Staging shared-login proof recorded 2026-09-03 (`TEST_MANCERA` + `demo.admin` email across Lifestyle, Academy, GEMA Preview; OneGrinders-unavailable safe failure on Academy Preview).
Change 3 is checked done — Staging, 2026-09-04. Person rows on both sides of the spine.
Change 4 is checked done — Staging, 2026-09-04. Card and trainee rows are created on first visit, never at signup; the owner confirmed the card by signing in. Academy stays "not enrolled" on Staging until its catalog lands there — recorded under *Left open* on that note, and not a fault in the Change.

That proof is a **Preview** proof — Preview env, Staging `fxdsnacuonfvutdquogb`. A `main`-branch deployment loads **Production** env, so a Staging username fails there by design, not by fault. See [[Change 2 - Shared login engine]].

```mermaid
flowchart TB
  OG["OneGrinders Guild"] --> AUTH["GEMA Supabase Auth\nkeep the real users"]
  AUTH --> PROF["one GutGuard person"]
  PROF --> HUB["Lifestyle HUB"]
  PROF --> GEMA["GEMA spoke"]
  PROF --> ACAD["Academy spoke"]
```

## Always

[[00 - Session gate]] — read first, before every task, and again after every task.  
[[00 - Locks]] · [[01 - Decisions]] · [[02 - Architecture]] · [[03 - Identity model]] · [[04 - UX]]

## Changes (do in order)

1. [[Change 1 - Staging identity freeze]] — **done** (Staging, 2026-08-28)
2. [[Change 2 - Shared login engine]] — **done** (Staging proof, 2026-09-03)
3. [[Change 3 - Public profiles]] — **done** (Staging, 2026-09-04)
4. [[Change 4 - Lazy product rows]] — **done** (Staging, 2026-09-04)
4b. [[Change 4b - Academy on Staging]] — **current** (opened 2026-09-04 from a live failure)
5. [[Change 5 - Hub chrome]]
6. [[Change 6 - Shared domain SSO]]

## Owner steps in only when

Listed on each Change. Typical: copy this folder to `C:\Users\najee\OneDrive\Documents\Obsidian Vault\One Account\`, Vercel env for Preview, custom domains, production cutover. Agents must not invent extra owner work.

## Repos

| Product | GitHub | Role |
|---|---|---|
| Lifestyle | `atc1989/GutGuard-Life-Style` | Hub. Member OS. |
| GEMA | `atc1989/GEMA` | Spoke. Identity spine + OneGrinders. Real users. |
| Academy | `atc1989/gentrep-academy` | Spoke. Training. Reset Auth ok. |
