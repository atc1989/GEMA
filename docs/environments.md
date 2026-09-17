# Environments — GEMA

Custom domains: `gema.gutguard.ph` was already Production before the 2026-09-12 spoke cutover. Academy and Lifestyle custom domains were switched in place the same day. Do not remove and re-add a domain to “fix” it.

## Production

```text
gema.gutguard.ph  →  Vercel Production (git branch main)
Auth / DB         →  rvwseybgimmewuoccecu
Git               →  atc1989/GEMA main  (b8ecea3 at Change 8 close)
```

Siblings:

```text
gentrep.gutguard.ph    →  atc1989/gentrep-academy main
lifestyle.gutguard.ph  →  atc1989/GutGuard-Life-Style main
```

## Staging

```text
gema-git-staging-atcs-projects-2f85c923.vercel.app
  → Vercel Preview of git branch staging
  → Vercel Deployment Protection (SSO) enabled
Auth / DB → fxdsnacuonfvutdquogb
```

Staging is **not** `gema.gutguard.ph`.

Production clinic/slots work stays on `main`. Staging received the Production auth-guard / session-survival files (`c5576e2`) so a failed check no longer signs members out. Do not merge clinic/slots into Staging to “catch up”.

## Auth (no secrets)

- Cookie Domain `.gutguard.ph` on `*.gutguard.ph`; host-only on `*.vercel.app`
- Production `site_url` remains `https://gut-guard-theta.vercel.app/my-account` (intentional)
- Redirect allow-list includes `gema.gutguard.ph`, `gentrep.gutguard.ph`, `lifestyle.gutguard.ph`
- Shared logout clears the session on all three hosts
