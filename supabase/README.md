# GEMA database layout

Live project: **GutGuard LifeStyle** (`rvwseybgimmewuoccecu`).

## Schemas

| Schema | Role |
| --- | --- |
| `gema` | All GEMA tables and app RPCs |
| `public` | Auth trigger functions (`handle_new_user`, `gutguard_handle_new_user`) and enum types. No GEMA base tables. |
| `doctors` | Empty, reserved for a later GutGuard Doctors migration |

The Next.js clients in `src/lib/supabase/` set `db: { schema: "gema" }` so
`.from(...)` and `.rpc(...)` hit `gema` without qualifying every call.

## API exposure (required)

PostgREST must expose `gema`. Confirm in Dashboard → Project Settings → API
→ Exposed schemas: `public, graphql_public, gema` (or at least `gema`).

If the dashboard list is missing `gema` and REST returns `PGRST106`, this
project currently also sets it on the authenticator role:

```sql
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, gema';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
```

Setting `pgrst.db_schemas` on `authenticator` makes the dashboard stop managing
the list. To hand control back after adding `gema` in the UI:

```sql
alter role authenticator reset pgrst.db_schemas;
notify pgrst, 'reload config';
```

## Historical SQL in this folder

Files such as `schema.sql`, `gema_existing_project_migration.sql`, and the
feature patches were written against `public` and **already applied**, then
objects were moved to `gema`. Do not re-run them on the live project — they
would recreate objects in `public`.

New patches for this project must use `gema.*`.
