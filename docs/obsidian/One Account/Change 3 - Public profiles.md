---
title: Change 3 - Public profiles
aliases:
  - Change 3
tags:
  - gutguard
  - one-account
  - change
---

# Change 3 — Public profiles

**Status:** current. [[Change 2 - Shared login engine]] is closed.

Read [[00 - Session gate]] and [[03 - Identity model]] before this Change.

## Goal

One person table at `public.profiles` with **the same UUIDs** as `auth.users` / existing `gema.profiles`. Lifestyle and Academy read it. GEMA keeps working.

## Vault reads

- Session gate, Locks, Decisions, Identity model
- Tech Stack: OWNER, Canonical, **Supabase** (RLS, views `security_invoker`)
- Design System: skip

## What `public.profiles` actually is — confirmed by query, 2026-09-04

An earlier pass on this Change recorded that Staging's `public.profiles` is the
Lifestyle card table. **That was wrong**, and everything built on it was wrong
with it. The claim came from a comment in Academy's
`20260827120000_person_only_new_user.sql` and from Lifestyle's migration files,
which define such a table — but those migrations were **never applied to
Staging**. The preflight is what caught it.

What is actually there:

| | |
|---|---|
| `public.profiles` | The person table GEMA extended from a pre-existing project: `id`, `email`, `first_name`, `last_name`, `full_name`, `created_at`, `updated_at`, `phone`, `role` (`app_role` enum), `is_admin`, `avatar_url`, `last_seen_at`, `can_publish_events`. Written on signup by `public.handle_new_user`. |
| `gema.profiles` | What the GEMA app actually reads — every client in `src/lib/supabase/` pins `db: { schema: "gema" }`. Shape still outstanding (preflight 10). |
| Lifestyle's card table | Not on Staging at all. |

So `public.profiles` is **already most of the person table this Change wants**,
and the armed trigger already writes it. Three identity columns are missing —
`locale`, `timezone`, `account_status` — and that is the small half of the work.

## The reason this Change is now urgent

`profiles_update_own` is `with check (id = auth.uid() and is_admin = false)`. It
pins `is_admin`. It says nothing about `role`. And `public.is_admin()` is:

```sql
select exists (select 1 from public.profiles
                where id = auth.uid() and (is_admin = true or role = 'admin'))
```

So one request from any signed-in member —

```sql
update profiles set role = 'admin' where id = auth.uid();
```

— passes the check, and `is_admin()` returns true for them from then on.
**Verified, not inferred**: `supabase/tests/run.sh` reproduces this schema on a
throwaway Postgres and shows `is_admin()` flipping to `t`, then shows the same
statement refused after the migration. `is_admin = true` is blocked; `role` is
not; `can_publish_events` has its own guard trigger.

This is what [[03 - Identity model]] means by "members must not write their own
roles". RLS cannot express column limits — column `GRANT`s can, and do not
depend on a policy's with-check staying correct as policies get redefined.

**The migration closes the door. It cannot say who already walked through it.**
Preflight 5b lists every row with `is_admin`, `role = 'admin'` or
`can_publish_events`. Only the owner can say which of those belong.

**Production.** The same policy and the same `is_admin()` are defined in GEMA's
`supabase/schema.sql`, so production may carry the same hole against ~431 real
accounts. Whether it does is a question for preflight 2 run against production —
read-only, and nothing else. Do not apply this migration to production; the
hard stop stands, and this is the owner's call to make, not an agent's.

## Work

- [ ] Add `locale`, `timezone`, `account_status` to `public.profiles`. *(written: GEMA `supabase/change3_shared_person_profiles.sql`)*
- [ ] Revoke the whole-row UPDATE from `authenticated`; grant back only the identity columns a person may edit about themselves.
- [ ] `account_status` through `public.set_account_status()`, admin only.
- [ ] Audit preflight 5b — who is already an admin, and should they be.
- [ ] Reconcile the Auth users with no person row. Nothing reliably writes both `public.profiles` and `gema.profiles`, so this is a decision per user, not a backfill.
- [ ] Decide what `gema.profiles` becomes once `public.profiles` is the person: a view, or the GEMA clients stop pinning the `gema` schema. Needs preflight 10 first.
- [ ] Lifestyle and Academy read `public.profiles` for name/email/phone.

## Proven locally

`GEMA/supabase/tests/run.sh` reproduces Staging's `public.profiles` — the real
column list, `public.is_admin()`, and the three policies as last redefined by
`member_event_publishing_permissions.sql` — then:

1. shows an ordinary member escalating to admin, `is_admin()` returning `t`;
2. applies the migration, and re-applies it to prove it is idempotent;
3. shows the same escalation refused with `permission denied for table profiles`;
4. runs `tests/database/002_profiles_privilege.test.sql`, which pins the identity
   columns, the `account_status` constraint, the absence of any member UPDATE
   grant on `role` / `is_admin` / `can_publish_events` / `account_status`, the
   presence of one on `full_name`, and a non-admin being refused by
   `set_account_status()`.

Confirmed alongside: a member can still edit their own `full_name` and `phone`
after the fix.

This proves the migration applies and does what it says on this schema. It does
not prove Staging carries these policies — that is preflight 2, outstanding.

## Preflight before applying

`GEMA/supabase/verify_change3_preflight.sql`, read-only. Section 1 came back on
2026-09-04 and is what disproved the Lifestyle-shaped premise. Still outstanding
and still gating the apply:

- **2** — the policies actually on Staging. The escalation above is proven
  against this repo's schema files, not against Staging itself.
- **3** — column grants already in place.
- **5b** — who is already an admin.
- **9** — the body of `public.handle_new_user`, so we know what a new Auth user
  really writes today.
- **10** — whether `gema.profiles` exists on Staging and in what shape.

Sections 6 and 7 give the Auth users with no person row, for the reconcile step.

## Owner steps in

Run the preflight and hand back 2, 3, 5b, 9, 10. Then apply
`change3_shared_person_profiles.sql` to **Staging only**.

Production is a separate decision and a separate conversation: the same policy
and `is_admin()` live in `schema.sql`, so the escalation may exist against the
real accounts too. Running the preflight against production is read-only and
safe; applying anything there is not this Change's business.

## Done when

Same id is the person in GEMA and in `public.profiles` on Staging, no member can
write their own `role`, and the GEMA member dashboard still loads.

## Next

[[Change 4 - Lazy product rows]]
