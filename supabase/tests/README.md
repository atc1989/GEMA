# Database tests

`./run.sh` builds a throwaway Postgres from `bootstrap_staging_shape.sql`,
applies `change3_shared_person_profiles.sql` and then
`change4_lazy_product_rows.sql` — each twice, so a migration that is not
idempotent fails here — and runs each `database/*.test.sql`. A migration that
would fail against the real schema fails here first.

It also shows the hole before each fix and its absence after: a member writing
their own `role` (Change 3), and two members sharing a card number (Change 4).

```
./run.sh          # needs a local postgres binary; PGBIN=/usr/lib/postgresql/16/bin
```

`bootstrap_staging_shape.sql` reproduces the Staging shape: both tables named
`profiles`, in their two schemas, the default Supabase grants, and the card
numbers as they actually are. It is not a model of Supabase, only enough of one
that the real migration files run unmodified.

Two things the harness does deliberately:

- It grants `ALL` on the public tables to `anon`/`authenticated` before
  re-applying the Change 3 migration, because that is what Supabase does by
  default. Without it the column-level `REVOKE` has nothing to revoke and the
  privilege test passes for the wrong reason.
- Every test file runs inside a transaction it rolls back, so tests do not see
  each other's rows.

This proves a migration *applies*. It does not prove Staging matches these
files — for that, run `../verify_change3_outstanding.sql` against Staging and
read the output first.
