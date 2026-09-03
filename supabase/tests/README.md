# Database tests

`./run.sh` builds a throwaway Postgres, applies every migration in
`../migrations/` in order, then runs each `database/*.test.sql`. A migration
that would fail against the real schema fails here first.

```
./run.sh          # needs a local postgres binary; PGBIN=/usr/lib/postgresql/16/bin
```

`bootstrap_local.sql` stubs the Supabase-owned objects the migrations touch —
`auth.users`, `auth.uid()`, the storage tables, the `gema` identity spine. It is
not a model of Supabase, only enough of one that the real migration files run
unmodified.

Two things the harness does deliberately:

- It grants `ALL` on the public tables to `anon`/`authenticated` before
  re-applying the Change 3 migration, because that is what Supabase does by
  default. Without it the column-level `REVOKE` has nothing to revoke and the
  privilege test passes for the wrong reason.
- Every test file runs inside a transaction it rolls back, so tests do not see
  each other's rows.

This proves a migration *applies*. It does not prove Staging matches these
files — for that, run `../verify_change3_preflight.sql` against Staging and read
the output first.
