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

# Demonstrate the hole BEFORE the fix: profiles_update_own covers the whole
# row, so a member can PATCH their own role and points.
psql -q -v ON_ERROR_STOP=1 -d postgres <<'SQL'
insert into auth.users (id, email) values ('cccc0000-0000-0000-0000-000000000001','probe@example.invalid');
insert into public.profiles (id, name, mobile, email, card_no)
  values ('cccc0000-0000-0000-0000-000000000001','Probe','09990000000','probe@example.invalid','GG-P001');
SQL
before=$(psql -X -t -A -d postgres 2>&1 <<'SQL'
set role authenticated;
set request.jwt.claim.sub = 'cccc0000-0000-0000-0000-000000000001';
update public.profiles set role = 'admin', points = 999999 where id = auth.uid();
select role || ' / points=' || points from public.profiles where id = auth.uid();
SQL
)
echo "before fix: member self-write -> $(echo "$before" | tail -1)"
psql -q -d postgres -c "update public.profiles set role='prospect', points=0 where id='cccc0000-0000-0000-0000-000000000001';"

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

# Change 4. Show the card numbers as they are first: one placeholder string
# shared by the whole membership, and nothing objecting to a duplicate.
before4=$(psql -X -t -A -d postgres -c "
  select 'members sharing a card number: ' ||
         coalesce(sum(n - 1), 0)
    from (select count(*) as n from public.profiles
           where card_no is not null and btrim(card_no) <> ''
           group by regexp_replace(btrim(card_no), '\s+', ' ', 'g')) counted;")
echo "before fix: $before4"

printf '%-46s ' "change4_lazy_product_rows.sql"
psql -q -v ON_ERROR_STOP=1 -d postgres -f "$HERE/../change4_lazy_product_rows.sql" >/dev/null 2>"$WORK/err.log" \
  && echo applied || { echo FAILED; cat "$WORK/err.log"; exit 1; }

printf '%-46s ' "re-apply (idempotency)"
psql -q -v ON_ERROR_STOP=1 -d postgres -f "$HERE/../change4_lazy_product_rows.sql" >/dev/null 2>"$WORK/err.log" \
  && echo ok || { echo FAILED; cat "$WORK/err.log"; exit 1; }

after4=$(psql -X -t -A -d postgres 2>&1 <<'SQL' || true
update public.profiles set card_no = '0240 9999 8888 7777'
 where id = 'eeee0000-0000-0000-0000-000000000004';
SQL
)
echo "after fix:  duplicate card number -> $(echo "$after4" | grep -o 'duplicate key value.*' | head -1 || echo 'STILL ALLOWED')"

for t in "$HERE"/database/*.test.sql; do
  printf '%-46s ' "$(basename "$t")"
  psql -q -X -v ON_ERROR_STOP=1 -d postgres -f "$t" >/dev/null 2>"$WORK/err.log" \
    && echo PASS || { echo FAIL; cat "$WORK/err.log"; exit 1; }
done
echo "all green"
