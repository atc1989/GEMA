# Gentrep / One Account — Full Project Status Audit

**Date:** 2026-09-12  
**Auditor:** Cursor agent (ATC)  
**Scope:** Gentrep Academy, GEMA, GutGuard Lifestyle, One Account board, Test Plan  
**Kind:** Audit, reconciliation, and reporting only  

No new Change was opened. Change 10 was not invented. No application feature code, database migration, `db push`, or Production write was performed.

---

## Boss-ready executive summary

```text
Gentrep / One Account Project Status
12 September 2026

Change 1 — DONE
Change 2 — DONE
Change 3 — DONE
Change 4 — DONE
Change 5 — DONE
Change 6 — DONE
Change 7 — DONE
Change 8 — DONE
Change 9 — DONE

One Account 4b — DONE
One Account 4c — DONE
One Account 6b — DONE
(One Account has no Change 7 or 8; those numbers are Academy-only.)

Gate 0 — PASS
Gate 1 — PASS
Gate 2 — PASS
Gate 3 — PASS
Gate 4 — PASS
Gate 5 — PASS
Gate 6 — PASS
Gate 7 — PASS
Gate 8 — PASS
Gate 9 — PASS
Gate 10 — PASS
Gate 11 — PASS
Gate 12 — PASS
Gate 13 — PASS
Gate 14 — PASS
Gate 15 — PASS

Current Change — NONE

Production Systems
Gentrep Academy — LIVE
GEMA — LIVE
GutGuard Lifestyle — LIVE

Unresolved required work — NONE
Deferred technical items — 5 (none block a closed Change)
```

---

## Completed Production Websites

Verified 2026-09-12 by HTTP headers, page boot, and (Academy + Lifestyle) compiled Auth project ref. Staging Preview URLs are not listed here.

| System             | Production URL                | Status | Operational Scope |
| ------------------ | ----------------------------- | ------ | ----------------- |
| Gentrep Academy    | https://gentrep.gutguard.ph   | LIVE   | Member training dashboard, bilingual documents, booking/attendance, certificates, public verify. Unsigned `/` → `/login`. `/admin` remains 404. Production Auth `rvwseybgimmewuoccecu`. |
| GEMA               | https://gema.gutguard.ph      | LIVE   | Public Discover, events, rewards, passes, member/admin desks behind sign-in. Unsigned `/` → `/discover`. Login page boots. No Vercel SSO on the custom domain. |
| GutGuard Lifestyle | https://lifestyle.gutguard.ph | LIVE   | Hub landing, registration, member OS `/app/*`, door card. Unsigned `/app` → `/`. Unsigned `/card` → `/register`. Production Auth `rvwseybgimmewuoccecu` in compiled JS. |

All three custom domains are Vercel Production of `main`, not Staging Preview. None showed Vercel Deployment Protection.

---

## Current Change

**none**

Change 9 is done. No approved later Change exists. Do not invent Change 10.

Authoritative board: product-repo copies of `docs/obsidian/One Account/One Account.md` (Academy, GEMA, Lifestyle) and `C:\Users\mance\OneDrive\Documents\GutGuard\One Account\One Account.md`. Najee’s Obsidian vault is not writable from this machine; the owner still copies that folder when convenient.

---

## Open Approved Work

NONE

---

## Change summary

Two numbering systems exist. They are not the same list.

### Academy To Do (Gentrep streamlining + Lifestyle Change 9)

| Change | Title | Status | Main Evidence | Remaining |
| ------ | ----- | ------ | ------------- | --------- |
| 1 | Complete shared-login Staging proof | DONE | One Account Change 2 Staging proof 2026-09-03; T-100–T-104 | None required (`ONEGRINDERS_LOGIN_URL` N/A) |
| 2 | Approve the streamlined Academy boundary | DONE | Owner decision 2026-09-03 | None |
| 3 | Lock prototype parity | DONE | `docs/prototype-parity-inventory.md`; owner baseline 2026-09-03 | None |
| 4 | Remove the Lifestyle admin portal | DONE | `/admin` 404; T-201/T-202; no `src/app/admin` | None |
| 5 | Reduce Academy roles and permissions | DONE | `academy_operator`; T-1101; role tests | None |
| 6 | Clean portal-only database objects | DONE | Inventory + forward drop; T-1000/T-1001 | None |
| 7 | Harden the retained Academy core | DONE | pgTAP, a11y note, concurrency; Gates 11–13 | None |
| 8 | Verify and release the streamlined system | DONE | `docs/change8-closure.md`; Production cutover 2026-09-12; Gates 0–14 | Deferred SQL / operator / fallback only |
| 9 | Member chrome identity (Lifestyle hub) | DONE | Lifestyle PR #41/#42/#43; T-910–T-924; this audit | None required |

### One Account (identity / hub)

| Change | Title | Status | Main Evidence | Remaining |
| ------ | ----- | ------ | ------------- | --------- |
| 1 | Staging identity freeze | DONE | Staging Auth freeze 2026-08-28 | None |
| 2 | Shared login engine | DONE | Staging 2026-09-03; Gate 1 | None |
| 3 | Public profiles | DONE | Staging 2026-09-04; own-row RLS | Left-open items belong to later Changes, already consumed |
| 4 | Lazy product rows | DONE | Staging 2026-09-04; PRs Lifestyle #27 / GEMA #34 / Academy #20 | None |
| 4b | Academy on Staging | DONE | Staging dashboard 2026-09-05 | None |
| 4c | One registration | DONE | Real-domain proof 2026-09-07 | None |
| 5 | Hub chrome | DONE | Real-domain 2026-09-07; Settings same day | Chrome leftover closed by Change 9 |
| 6 | Shared domain SSO | DONE | Staging `gutguard.ph` 2026-09-07 | None |
| 6b | Staging on the real domain | DONE | 2026-09-07; addendum after Production cutover | Historical Staging-on-domain proof |
| 9 | Member chrome identity | DONE | Staging + Production Lifestyle 2026-09-12 | None |

There is no One Account Change 7 or 8.

---

## Gate summary

| Gate | Change | Tests | Status | Notes |
| ---- | ------ | ----- | ------ | ----- |
| Gate 0 | Academy 7/8 | T-000–T-004 | PASS | Audit reconfirmed Academy 166 tests / lint / typecheck / build |
| Gate 1 | Academy 1 / OA 2 | T-100–T-104 | PASS | T-104 keeps 2026-09-03 outage evidence; 2026-09-11 recheck was not repeated |
| Gate 2 | Academy 4 | T-200–T-202 | PASS | `/admin` 404 reconfirmed on Production this audit |
| Gate 3 | Academy 3/8 | T-300–T-302 | PASS | |
| Gate 4 | Academy 8 | T-400–T-402 | PASS | Isolated `[TEST]` re-agree 2026-09-12 |
| Gate 5 | Academy 8 | T-500–T-507 | PASS | T-501 RPC; live double-click not run. T-507 does not claim rescheduled-history |
| Gate 6 | Academy 8 | T-600–T-602 | PASS | |
| Gate 7 | Academy 8 | T-700–T-702 | PASS | |
| Gate 8 | Academy 8 | T-800–T-803 | PASS | |
| Gate 9 | Academy 8 | T-900–T-904 | PASS | T-1103 later closed the rate-limit note |
| Gate 10 | Academy 6 | T-1000–T-1001 | PASS | Isolated Staging-copy restore not re-run |
| Gate 11 | Academy 7/8 | T-1100–T-1103 | PASS | |
| Gate 12 | Academy 7/8 | T-1200–T-1204 | PASS | Not a full Preview keyboard / 44px pack |
| Gate 13 | Academy 8 | T-1300–T-1303 | PASS | Mid-submit expired JWT not separately injected |
| Gate 14 | Academy 8 | Gate roll-up + Production smoke | PASS | Cutover 2026-09-12 |
| Gate 15 | Change 9 | T-910–T-924 | PASS | Checkboxes reconciled this audit |

---

## Authoritative sources

| Artifact | Authoritative copy | Mirrors |
| -------- | ------------------- | ------- |
| One Account board | Product-repo `docs/obsidian/One Account/` (kept in sync across Academy, GEMA, Lifestyle this audit) | `C:\Users\mance\OneDrive\Documents\GutGuard\One Account\` |
| Najee vault | `C:\Users\najee\OneDrive\Documents\Obsidian Vault\One Account\` | Not writable here; owner copy |
| Academy To Do | `C:\Users\mance\OneDrive\Documents\GutGuard\Gentrep Academy To Do.md` | None in git |
| Test Plan | `C:\Users\mance\OneDrive\Documents\GutGuard\Gentrep Academy Test Plan.md` | None in git |
| Change 8 closure | Academy `docs/change8-closure.md` | Historical SHA table at closure |
| Change 9 plan | Academy `docs/change9-plan.md` | Lifestyle stub pointer |
| Environments | Academy `docs/environments.md` | |
| This audit | Academy `docs/project-status-audit.md` | OneDrive GutGuard copy; Lifestyle/GEMA pointers |

Tech Stack and Design System vaults were not edited.

---

## Git heads as of this audit

| Repo | Production `main` | Staging | Notes |
| ---- | ----------------- | ------- | ----- |
| `atc1989/gentrep-academy` | `d662f2c` | `3c897d2` | Change 8 app merge `c366d4f` is an ancestor of `main`. Staging has Change 9 board-close docs. |
| `atc1989/GEMA` | `222d5ff` | `7f0d54c` | Staging has Change 9 board-close docs. |
| `atc1989/GutGuard-Life-Style` | `d58fc58` | `eef5160` | Chrome merge `d00488c`; board-close PR #43. Change 9 rollback point `6c49daa`. |

---

## Repository health (2026-09-12 audit)

| Repo | Tests | Lint | Typecheck | Build | Affects a closed Change? |
| ---- | ----- | ---- | --------- | ----- | ------------------------ |
| Academy | 166 pass / 0 fail | PASS | PASS | PASS | No. T-000 originally cited 133 tests; later hardening added tests. |
| Lifestyle | 123 pass / 0 fail | PASS | PASS (`tsc` + `next build`) | PASS | No. Confirms T-922. |
| GEMA | No unit-test script in `package.json` | 0 errors / 24 `no-img-element` warnings | PASS via `next build` | PASS | No. Warnings are pre-existing landing `<img>` usage, not a Change 8/9 reopen. |

---

## Production website evidence

### Gentrep Academy — https://gentrep.gutguard.ph

- Resolves. Vercel Production. No Deployment Protection.
- `GET /` → 307 `/login`. `GET /login` → 200, Sign in page boots (username/email + password, One Account copy).
- `GET /admin` → 404.
- Compiled JS chunk contains `rvwseybgimmewuoccecu`, not Staging `fxdsnacuonfvutdquogb`.

### GEMA — https://gema.gutguard.ph

- Resolves. Vercel Production. No Deployment Protection.
- `GET /` → 307 `/discover`. Discover page boots (Gutguard Events / Discover).
- Login page boots (`/login`).
- Auth project string is not inlined in the public login JS scanned this session (server-action login). Custom domain + sibling apps on `rvwsey…` + Change 8 cutover remain the Production-backend evidence.

### GutGuard Lifestyle — https://lifestyle.gutguard.ph

- Resolves. Vercel Production. No Deployment Protection.
- `GET /` → 200, guest welcome page boots.
- `GET /app` → 307 `/`. `GET /card` → 307 `/register`.
- Compiled JS chunk contains `rvwseybgimmewuoccecu`, not `fxdsn…`.

No Production writes were performed during this audit.

---

## Detailed Change evidence

### Academy Change 1 — DONE

**Title:** Complete shared-login Staging proof  
**Primary repo:** All three (proof); board in One Account Change 2  
**Scope:** Same Staging username/email across Lifestyle, Academy, GEMA Preview  
**Evidence:** Academy To Do verification boxes; Test Plan T-100–T-104; 2026-09-03 recorded proof  
**Tests:** Gate 1 PASS  
**Staging:** Proven  
**Production:** Not required for this Change (Production Auth freeze was the point of Change 1 / OA 1)  
**Remaining:** `ONEGRINDERS_LOGIN_URL` optional owner action — default worked; marked N/A this audit  
**Conclusion:** DONE

### Academy Change 2 — DONE

Owner scope freeze 2026-09-03. Keep/remove lists checked. DONE.

### Academy Change 3 — DONE

Prototype parity inventory + owner baseline 2026-09-03. DONE.

### Academy Change 4 — DONE

Lifestyle `/admin` removed from Academy. Production `/admin` still 404 this audit. T-201/T-202 PASS. DONE.

### Academy Change 5 — DONE

Roles reduced to member / staff / trainer / `academy_operator`. Tests still green. DONE.

### Academy Change 6 — DONE

Portal objects dropped from Academy schema; T-1000/T-1001. DONE.

### Academy Change 7 — DONE

Core hardening, pgTAP, a11y evidence, concurrency. Gates 11–13 PASS. DONE.

### Academy Change 8 — DONE

**Title:** Verify and release the streamlined system  
**Evidence:** `docs/change8-closure.md` CLOSED 2026-09-12; Gates 0–14 checked with dated results; Production domains live  
**Staging:** PR #40 `5de710a` and subsequent Staging commits; localhost Next → Staging Auth used where Preview SSO blocked hosted clicks  
**Production:** Custom domains switched in place to Production `main` / Auth `rvwsey…`. Academy merge `c366d4f`  
**Deferred (do not reopen):** `20260911153100`, `20260911154000`, expected `rescheduled_from` 400, Production operator smoke, Lifestyle Staging `app_roles` / `webhook_events`  
**Follow-up #5 (chrome “Member”)** was a leftover, not a Change 8 fail. Closed by Change 9. Closure doc updated this audit.  
**Conclusion:** DONE

### Academy / One Account Change 9 — DONE

**Title:** Member chrome identity  
**Primary repo:** `atc1989/GutGuard-Life-Style`  
**Scope:** Server-read own `public.profiles` row into `/app/*` chrome; Settings revalidate; guest lock unchanged; no SQL  
**Implementation:** `lib/lifestyle/member-chrome.ts`, `load-member-chrome.ts` (`server-only`, no `userId` arg, no admin), `app/app/layout.tsx`, `saveProfile` → `revalidatePath("/app", "layout")`  
**Git:** PR #41 staging `eef5160`; PR #42 Production `d00488c`; PR #43 docs `d58fc58`; rollback `6c49daa`  
**Tests:** T-910–T-924 PASS (Gate 15 reconciled this audit)  
**Staging:** Local Next against Staging Auth; Preview SSO still on  
**Production:** T-924 read-only 2026-09-12; unsigned Production reconfirmed this audit  
**Conclusion:** DONE

### One Account Changes 1, 2, 3, 4, 4b, 4c, 5, 6, 6b — DONE

Board index already listed them done. Several **note headers** were stale (`open` / `blocked` / `current` / `in progress`) in GEMA, Lifestyle Change 4b, and OneDrive. Copied from the Academy done notes this audit. Index and Current change were already none / Change 9 done.

---

## Deferred / Technical Debt

These are **not** failed required items.

### 1. `20260911153100` (`academy.training_events.rescheduled_from`)

- **Reason deferred:** Not required for completed Change 8 behavior. App fallback on `42703` / `PGRST204`.
- **Current state (re-queried 2026-09-12):** Staging ledger `status=deferred`, `applied_at` null. Production ledger `status=deferred`. Column **absent** on Staging and Production.
- **Future trigger:** A later Change that needs reschedule history.
- **Blocks completed Change?** NO

### 2. `20260911154000` (completed-rank attendance guard)

- **Reason deferred:** Would change proven operator-correction behavior.
- **Current state:** Staging and Production ledger `status=deferred`, `applied_at` null.
- **Future trigger:** Operator-correction product Change after a real Production operator exists.
- **Blocks completed Change?** NO

### 3. Production `academy_operator` positive smoke

- **Reason deferred:** Production has zero operator rows by design.
- **Current state (re-queried):** `public.user_roles` `academy_operator` count = **0**.
- **Future trigger:** Legitimate operator is provisioned.
- **Blocks completed Change?** NO

### 4. Lifestyle Staging `public.app_roles` / `public.webhook_events`

- **Reason deferred:** Member chrome / Change 8 / Change 9 do not need them.
- **Current state (re-queried):** Staging `to_regclass` both **null**. Production both **present**.
- **Future trigger:** Lifestyle Staging admin/webhook paths.
- **Blocks completed Change?** NO

### 5. Expected first `rescheduled_from` 400 then retry

- **Reason deferred:** Accepted Change 8 debt while the column is absent.
- **Current state:** Fallback still in `src/lib/academy/queries.ts`. Column still absent.
- **Future trigger:** Applying `20260911153100` or a capability probe. Do not apply SQL just to hide the 400.
- **Blocks completed Change?** NO

Adjacent non-Change leftovers (not required, not deferred SQL): Health/Team/Story content still guest-default under Supabase; GEMA `no-img-element` lint warnings; Staging Preview Vercel SSO; Production Academy catalog has 0 events / 0 certificates / 0 operators; Najee vault copy lag.

---

## Documentation Corrections Made

- Gate 15 T-910–T-924 were still `[ ]` after Change 9 Production verification. Updated to `[x]` PASS / Gate 15 CLOSED.
- Test Plan completion record still said Change 9 PLANNED / not implemented. Updated to Change 9 DONE, Current none, current git heads.
- T-903 parenthetical still said T-1103 OPEN after T-1103 PASS. Corrected.
- Gate 0 header still said PR #33 not merged to `main`. Noted later merge + audit reconfirmation.
- Change 8 closure follow-up #5 still said chrome leftover / Change 9 not started. Marked closed by Change 9.
- `docs/environments.md` Production SHA stopped at `c366d4f`. Recorded current heads.
- `docs/change9-plan.md` planning footer still said Current = Change 9 not implemented. Marked historical; Current none.
- One Account Change **note headers** stale in GEMA (4b current, 4c/6 in progress), Lifestyle (4b current), OneDrive (1 open, 2/3/4/6 blocked; missing 4b/4c). Replaced from Academy done notes.
- `DROP-IN.md` in all four copies still said “Current change is Change 1”. Now: read Current change from `One Account.md`.
- Academy To Do leftover unchecked `ONEGRINDERS_LOGIN_URL` (conditional). Marked N/A; default endpoint worked.
- Academy To Do frontmatter date 2026-09-02 → 2026-09-12.

---

## Individual test appendix

### Gate 0

[x] T-000 PASS — 2026-09-11 PR #33 (133 tests then). Audit 2026-09-12: 166 pass.  
[x] T-001 PASS — typecheck. Audit reconfirmed.  
[x] T-002 PASS — lint. Audit reconfirmed.  
[x] T-003 PASS — production build. Audit reconfirmed.  
[x] T-004 PASS — pgTAP + concurrency on PR #33 / Change 8. Not re-run this audit (no local DB required for closed Change).

### Gate 1

[x] T-100 PASS — 2026-09-11 `TEST_MANCERA` three Staging apps.  
[x] T-101 PASS — 2026-09-11 `demo.admin` email.  
[x] T-102 PASS — 2026-09-11 throttle.  
[x] T-103 PASS — 2026-09-11 no product row at login.  
[x] T-104 PASS — 2026-09-03 Preview outage evidence. 2026-09-11 recheck not completed. Covered again by T-1302.

### Gate 2

[x] T-200 PASS — 2026-09-11 member routes.  
[x] T-201 PASS — 2026-09-11 `/admin/**` 404. Production `/admin` 404 reconfirmed 2026-09-12.  
[x] T-202 PASS — 2026-09-11 no admin source trees.

### Gate 3

[x] T-300 PASS — 2026-09-11 desktop BASE.  
[x] T-301 PASS — 2026-09-11 locked later ranks.  
[x] T-302 PASS — 2026-09-05/06 persist.

### Gate 4

[x] T-400 PASS — EN agree 2026-09-05.  
[x] T-401 PASS — TL agree 2026-09-05.  
[x] T-402 PASS — isolated `[TEST]` re-agree 2026-09-12.

### Gate 5

[x] T-500 PASS — reserve 2026-09-05.  
[x] T-501 PASS — RPC double-book 2026-09-12 (live UI double-click not run).  
[x] T-502 PASS — atomic switch 2026-09-05.  
[x] T-503 PASS — keep-seat 2026-09-12.  
[x] T-504 PASS — two-member last seat 2026-09-12.  
[x] T-505 PASS — cancel 2026-09-05.  
[x] T-506 PASS — waitlist 2026-09-05.  
[x] T-507 PASS — recovery copy 2026-09-12; rescheduled-history not claimed (column still absent).

### Gate 6

[x] T-600 PASS — assigned attendance 2026-09-05/06.  
[x] T-601 PASS — unassigned deny.  
[x] T-602 PASS — operator correction 2026-09-12.

### Gate 7

[x] T-700 PASS — trainer confirm.  
[x] T-701 PASS — reject then confirm.  
[x] T-702 PASS — unassigned deny.

### Gate 8

[x] T-800 PASS — BASE incomplete until 9/9.  
[x] T-801 PASS — TL unlock.  
[x] T-802 PASS — isolated derived credit 2026-09-12.  
[x] T-803 PASS — rank prereq.

### Gate 9

[x] T-900 PASS — one BASE cert.  
[x] T-901 PASS — public payload.  
[x] T-902 PASS — download/share.  
[x] T-903 PASS — valid + invalid public page.  
[x] T-904 PASS — revoke/reissue.

### Gate 10

[x] T-1000 PASS — inventory + drop. Isolated restore not re-run.  
[x] T-1001 PASS — no portal write surface.

### Gate 11

[x] T-1100 PASS — isolation.  
[x] T-1101 PASS — roles.  
[x] T-1102 PASS — secret scan.  
[x] T-1103 PASS — rate-limit 2026-09-12.

### Gate 12

[x] T-1200 PASS — keyboard/focus (not full staff Preview pack).  
[x] T-1201 PASS — semantics.  
[x] T-1202 PASS — targets (not live 44px pack).  
[x] T-1203 PASS — reflow 2026-09-12.  
[x] T-1204 PASS — reduced motion.

### Gate 13

[x] T-1300 PASS — offline/retry 2026-09-12.  
[x] T-1301 PASS — sign-out redirect (mid-submit JWT not injected).  
[x] T-1302 PASS — OneGrinders outage copy.  
[x] T-1303 PASS — recovery to server codes.

### Gate 14

[x] All prior gates PASS (roll-up).  
[x] No open P0/P1.  
[x] Owner Production cutover 2026-09-12.  
[x] Rollback documented.  
[x] Production env/domains reviewed without revealing secrets.  
[x] Production smoke (login, dashboard, read-only events, verify, `/admin` 404, no mutation) recorded at Change 8 close. Unsigned Production `/admin` 404 reconfirmed this audit.

### Gate 15

[x] T-910 PASS  
[x] T-911 PASS  
[x] T-912 PASS  
[x] T-913 PASS  
[x] T-914 PASS  
[x] T-915 PASS  
[x] T-916 PASS  
[x] T-917 PASS  
[x] T-918 PASS  
[x] T-919 PASS  
[x] T-920 PASS  
[x] T-921 PASS  
[x] T-922 PASS  
[x] T-923 PASS  
[x] T-924 PASS  

---

## Copy map after this audit

| Copy | Current change | Change 9 | Gate 15 |
| ---- | -------------- | -------- | ------- |
| Academy One Account | none | done | n/a (Test Plan is OneDrive) |
| GEMA One Account | none | done | n/a |
| Lifestyle One Account | none | done | n/a |
| OneDrive One Account | none | done | n/a |
| Academy To Do | none | Done | T-910–T-924 claimed done |
| Test Plan | none | DONE | PASS / CLOSED |
| Najee vault | unknown until owner copies | unknown | unknown |

---

## Final consistency

```text
GENTREP / ONE ACCOUNT — FULL PROJECT AUDIT COMPLETE

CHANGES
Academy 1–9 — DONE
One Account 1, 2, 3, 4, 4b, 4c, 5, 6, 6b, 9 — DONE

Current Change:
NONE

TEST PLAN
Gate 0 — PASS
Gate 1 — PASS
Gate 2 — PASS
Gate 3 — PASS
Gate 4 — PASS
Gate 5 — PASS
Gate 6 — PASS
Gate 7 — PASS
Gate 8 — PASS
Gate 9 — PASS
Gate 10 — PASS
Gate 11 — PASS
Gate 12 — PASS
Gate 13 — PASS
Gate 14 — PASS
Gate 15 — PASS

Unchecked tests that are actually complete:
NONE (Gate 15 reconciled)

Checked tests without evidence:
NONE (caveats recorded; none are silent checks)

OPEN APPROVED WORK:
NONE

DEFERRED / TECHNICAL DEBT:
1. 20260911153100 not applied (column absent Staging + Production)
2. 20260911154000 not applied
3. Production academy_operator positive smoke (0 operators)
4. Lifestyle Staging missing app_roles / webhook_events
5. Expected rescheduled_from 400 then fallback

PRODUCTION WEBSITES
Gentrep Academy
https://gentrep.gutguard.ph
Status: LIVE

GEMA
https://gema.gutguard.ph
Status: LIVE

GutGuard Lifestyle
https://lifestyle.gutguard.ph
Status: LIVE

DOCUMENTATION
Academy board: CONSISTENT
GEMA board: CONSISTENT
Lifestyle board: CONSISTENT
One Account (product copies + Mancera OneDrive): CONSISTENT
Najee vault: OWNER COPY STILL REQUIRED
Test Plan: CONSISTENT

Audit document:
docs/project-status-audit.md
(and OneDrive GutGuard/project-status-audit.md)

Feature implementation performed:
NONE

Database changes:
NONE

Production changes:
NONE

New Change invented:
NO
```
