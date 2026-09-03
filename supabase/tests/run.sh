#!/usr/bin/env bash
# Reproduce Staging's public.profiles on a throwaway Postgres, show the
# privilege hole is reachable, apply the Change 3 migration, then show it is
# closed and the tests pass.
set -euo pipefail

PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK=${WORK:-/var/tmp/gema-pgtest}
PORT=${PORT:-5435}
export PATH="$PGBIN:$PATH" PGHOST="$WORK" PGPORT="$PORT" PGUSER=postgres

cleanup() { pg_ctl -D "$WORK/pgdata" stop -m immediate >/dev/null 2>&1 || true; }
trap cleanup EXIT

rm -rf "$WORK"; mkdir -p "$WORK/pgdata"; chmod 755 "$WORK"
if [ "$(id -u)" = 0 ]; then chown -R postgres "$WORK"; AS="su postgres -c"; else AS="bash -c"; fi
$AS "PATH=$PGBIN:\$PATH initdb -D $WORK/pgdata -A trust -U postgres" >/dev/null
$AS "PATH=$PGBIN:\$PATH pg_ctl -D $WORK/pgdata -o '-k $WORK -p $PORT -c listen_addresses=' -l $WORK/pg.log start -w" >/dev/null

psql -q -v ON_ERROR_STOP=1 -d postgres -f "$HERE/bootstrap_staging_shape.sql"

# Demonstrate the hole BEFORE the fix: an ordinary member sets role = 'admin'
# and public.is_admin() starts returning true for them.
psql -q -v ON_ERROR_STOP=1 -d postgres <<'SQL'
insert into auth.users (id, email) values ('cccc0000-0000-0000-0000-000000000001','probe@example.invalid');
insert into public.profiles (id, email, full_name, role)
  values ('cccc0000-0000-0000-0000-000000000001','probe@example.invalid','Probe','member');
SQL
before=$(psql -X -t -A -d postgres <<'SQL'
set role authenticated;
set request.jwt.claim.sub = 'cccc0000-0000-0000-0000-000000000001';
update public.profiles set role = 'admin' where id = auth.uid();
select public.is_admin();
SQL
)
echo "before fix: member self-escalation -> is_admin() = $(echo "$before" | tail -1)"
psql -q -d postgres -c "update public.profiles set role='member' where id='cccc0000-0000-0000-0000-000000000001';"

printf '%-46s ' "change3_shared_person_profiles.sql"
psql -q -v ON_ERROR_STOP=1 -d postgres -f "$HERE/../change3_shared_person_profiles.sql" >/dev/null 2>"$WORK/err.log" \
  && echo applied || { echo FAILED; cat "$WORK/err.log"; exit 1; }

printf '%-46s ' "re-apply (idempotency)"
psql -q -v ON_ERROR_STOP=1 -d postgres -f "$HERE/../change3_shared_person_profiles.sql" >/dev/null 2>"$WORK/err.log" \
  && echo ok || { echo FAILED; cat "$WORK/err.log"; exit 1; }

after=$(psql -X -t -A -d postgres 2>&1 <<'SQL' || true
set role authenticated;
set request.jwt.claim.sub = 'cccc0000-0000-0000-0000-000000000001';
update public.profiles set role = 'admin' where id = auth.uid();
SQL
)
echo "after fix:  member self-escalation -> $(echo "$after" | grep -o 'permission denied.*' || echo 'STILL ALLOWED')"

for t in "$HERE"/database/*.test.sql; do
  printf '%-46s ' "$(basename "$t")"
  psql -q -X -v ON_ERROR_STOP=1 -d postgres -f "$t" >/dev/null 2>"$WORK/err.log" \
    && echo PASS || { echo FAIL; cat "$WORK/err.log"; exit 1; }
done
echo "all green"
