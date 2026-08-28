# One Account — shared login engine

Change 2 on the [One Account board](../../../docs/obsidian/One%20Account/One%20Account.md).

`02 - Architecture` says: **shared login is a module, not three divergent copies.**
There is no monorepo (D7), so the module is mirrored byte-for-byte:

| Repo | Path |
|---|---|
| GEMA (**source of truth**) | `src/lib/one-account/` |
| Gentrep Academy | `src/lib/one-account/` |
| GutGuard Lifestyle | `lib/one-account/` |

Edit it in GEMA, run `node src/lib/one-account/rebuild-mirror.mjs`, then copy the
whole directory into the other two in the same change. `npm test` in Lifestyle
and Academy fails when a copy has been edited without re-mirroring. The
`version` in `mirror.ts` is the module's fingerprint — if the three repos print
different versions, one of them is stale.

## What is in here

Only behaviour that must be identical on every origin:

- `onegrinders.ts` — verifies a username/password against the OneGrinders API,
  normalises the account, maps a username to its synthetic auth email.
- `provision.ts` — the identity spine. Ensures the shared auth user, mirrors the
  verified password, and keeps the GEMA profile/member row in step.
- `login-engine.ts` — the sign-in orchestration: throttle, local-first mirror,
  external verification, backup path, session sign-in.

## What is **not** in here

- **UI.** No Tailwind, no shadcn, no components. Each app renders its own
  "Username or email" field in its own dialect.
- **Redirects.** The engine returns an outcome; each app decides where a member
  lands (see `04 - UX`).
- **Product rows.** The provisioner writes the GEMA profile/member spine and
  nothing else. It must never write an Academy BASE row or a Lifestyle card —
  those are lazy, on first visit, in Change 4.
- **Framework imports.** Nothing from `next/*`, so the module works on Next 15
  (GEMA) and Next 16 (spokes) alike. `after()`, `headers()`, and `redirect()`
  are passed in or stay in the app.
- **TypeScript that has to be compiled away.** Lifestyle runs the mirrored tests
  under `node --experimental-strip-types`, which refuses parameter properties,
  enums, and namespaces. Keep to syntax that survives having its types stripped.

## Environment

Server-only, never `NEXT_PUBLIC_`:

- `SUPABASE_SERVICE_ROLE_KEY` — required on any app that hosts login.
- `ONEGRINDERS_API_KEY` — required for username login.
- `ONEGRINDERS_LOGIN_URL` — optional endpoint override.
- `ONE_ACCOUNT_IDENTITY_SCHEMA` — optional; defaults to `gema`.

Email + password login works without the OneGrinders key. A missing key only
turns off the username half.
