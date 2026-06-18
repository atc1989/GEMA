-- GEMA Referrals -> Commissions (conversion-triggered, multi-level)
-- Builds/maintains the genealogy closure table, converts a prospect into a
-- member, and generates a multi-level commission ledger up the new member's
-- upline. SECURITY DEFINER routines (owned by postgres) bypass RLS; the live
-- migration only ships SELECT policies for genealogy/commissions.
--
-- Run once against the GEMA Supabase project (after schema + member_onboarding).
-- Safe to re-run.

-- Idempotency key for conversion commissions (one per earner/new-member/level).
create unique index if not exists commissions_conversion_unique
on public.commissions (earner_member_id, source_member_id, level_depth)
where source_member_id is not null and order_id is null;

-- ---------------------------------------------------------------------------
-- Genealogy maintenance
-- ---------------------------------------------------------------------------

/* Inserts a member's closure rows: self (depth 0) + sponsor's ancestor chain +1. */
create or replace function public.link_member_genealogy(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sponsor uuid;
begin
  insert into public.genealogy (ancestor_member_id, descendant_member_id, depth)
  values (p_member_id, p_member_id, 0)
  on conflict do nothing;

  select sponsor_member_id into v_sponsor from public.members where id = p_member_id;

  if v_sponsor is not null then
    insert into public.genealogy (ancestor_member_id, descendant_member_id, depth)
    select g.ancestor_member_id, p_member_id, g.depth + 1
    from public.genealogy g
    where g.descendant_member_id = v_sponsor
    on conflict do nothing;
  end if;
end;
$$;

-- One-time backfill of closure rows for all existing members.
with recursive chain as (
  select id as descendant_member_id, id as ancestor_member_id, 0 as depth
  from public.members
  union all
  select c.descendant_member_id, m.sponsor_member_id, c.depth + 1
  from chain c
  join public.members m on m.id = c.ancestor_member_id
  where m.sponsor_member_id is not null and c.depth < 50
)
insert into public.genealogy (ancestor_member_id, descendant_member_id, depth)
select ancestor_member_id, descendant_member_id, depth
from chain
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- onboard_member (recreated to also maintain genealogy)
-- ---------------------------------------------------------------------------

create or replace function public.onboard_member(
  p_username text,
  p_sponsor_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_existing public.members;
  v_username citext := nullif(trim(p_username), '')::citext;
  v_sponsor uuid := null;
  v_code text;
  v_attempt int := 0;
begin
  if v_uid is null then
    raise exception 'You must be signed in' using errcode = '42501';
  end if;

  select * into v_existing from public.members where profile_id = v_uid;
  if found then
    return jsonb_build_object(
      'member_id', v_existing.id,
      'member_code', v_existing.member_code,
      'username', v_existing.username
    );
  end if;

  if v_username is null or length(v_username) < 3 then
    raise exception 'Username must be at least 3 characters' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.members where username = v_username) then
    raise exception 'That username is already taken' using errcode = 'unique_violation';
  end if;

  if p_sponsor_ref is not null and length(trim(p_sponsor_ref)) > 0 then
    select referrer_member_id into v_sponsor
    from public.referrals
    where ref_code = trim(p_sponsor_ref) and status in ('active', 'claimed')
    limit 1;
    if v_sponsor is null then
      select id into v_sponsor
      from public.members where username = trim(p_sponsor_ref)::citext limit 1;
    end if;
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := 'M' || to_char(now(), 'YYMMDD') || upper(substr(md5(gen_random_uuid()::text), 1, 5));
    exit when not exists (select 1 from public.members where member_code = v_code);
    if v_attempt >= 8 then
      raise exception 'Could not allocate a member code, please retry';
    end if;
  end loop;

  insert into public.members (
    profile_id, sponsor_member_id, member_code, username, status, joined_at, activated_at
  )
  values (v_uid, v_sponsor, v_code, v_username, 'active', now(), now())
  returning * into v_existing;

  perform public.link_member_genealogy(v_existing.id);

  return jsonb_build_object(
    'member_id', v_existing.id,
    'member_code', v_existing.member_code,
    'username', v_existing.username
  );
end;
$$;

revoke all on function public.onboard_member(text, text) from public;
grant execute on function public.onboard_member(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Multi-level commission generation (conversion-triggered)
-- ---------------------------------------------------------------------------

/*
 * Walks the new member's upline (genealogy depth 1..5) and inserts one pending
 * commission per ancestor. Rate is the earner's rank rate, falling back to a
 * per-level default so payouts are visible when ranks are unset. Idempotent.
 */
create or replace function public.generate_conversion_commissions(
  p_new_member_id uuid,
  p_basis_amount numeric
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_rate integer;
  v_amount numeric(12, 2);
  v_defaults integer[] := array[1000, 500, 300, 200, 100];
  v_count integer := 0;
begin
  for r in
    select g.ancestor_member_id as earner, g.depth, m.rank_id
    from public.genealogy g
    join public.members m on m.id = g.ancestor_member_id
    where g.descendant_member_id = p_new_member_id
      and g.depth between 1 and 5
    order by g.depth
  loop
    v_rate := coalesce(
      nullif((select commission_rate_bps from public.ranks where id = r.rank_id), 0),
      v_defaults[r.depth]
    );
    v_amount := round(p_basis_amount * v_rate / 10000.0, 2);

    insert into public.commissions (
      earner_member_id, source_member_id, level_depth, basis_amount,
      commission_rate_bps, amount, status, rank_id, currency, metadata
    )
    values (
      r.earner, p_new_member_id, r.depth, p_basis_amount,
      v_rate, v_amount, 'pending', r.rank_id, 'PHP',
      jsonb_build_object('kind', 'conversion')
    )
    on conflict (earner_member_id, source_member_id, level_depth)
      where source_member_id is not null and order_id is null
    do nothing;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Prospect -> member conversion
-- ---------------------------------------------------------------------------

/*
 * Converts a prospect into an active member linked to an existing profile
 * (created by the server action via the service-role client), maintains
 * genealogy, marks the prospect converted, and generates commissions.
 * Returns { member_id }.
 */
create or replace function public.convert_prospect_to_member(
  p_prospect_id uuid,
  p_profile_id uuid,
  p_basis_amount numeric default 500
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prospect public.prospects;
  v_member_id uuid := gen_random_uuid();
  v_username citext;
  v_code text;
  v_attempt int := 0;
begin
  select * into v_prospect from public.prospects where id = p_prospect_id;
  if not found then
    raise exception 'Prospect not found' using errcode = 'no_data_found';
  end if;
  if v_prospect.converted_member_id is not null then
    raise exception 'Prospect already converted' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.members where profile_id = p_profile_id) then
    raise exception 'This account is already a member' using errcode = 'unique_violation';
  end if;

  -- Derive a unique username from the email local-part (fallback to the id).
  v_username := lower(regexp_replace(
    split_part(coalesce(v_prospect.email, ''), '@', 1), '[^a-zA-Z0-9_]', '', 'g'
  ))::citext;
  if v_username is null or length(v_username) < 3 then
    v_username := ('m' || substr(replace(p_profile_id::text, '-', ''), 1, 8))::citext;
  end if;
  while exists (select 1 from public.members where username = v_username) loop
    v_username := (v_username::text || substr(md5(gen_random_uuid()::text), 1, 3))::citext;
  end loop;

  loop
    v_attempt := v_attempt + 1;
    v_code := 'M' || to_char(now(), 'YYMMDD') || upper(substr(md5(gen_random_uuid()::text), 1, 5));
    exit when not exists (select 1 from public.members where member_code = v_code);
    if v_attempt >= 8 then
      raise exception 'Could not allocate a member code';
    end if;
  end loop;

  insert into public.members (
    id, profile_id, sponsor_member_id, member_code, username, status, joined_at, activated_at
  )
  values (
    v_member_id, p_profile_id, v_prospect.sponsor_member_id, v_code, v_username,
    'active', now(), now()
  );

  perform public.link_member_genealogy(v_member_id);

  update public.prospects
  set converted_member_id = v_member_id,
      converted_at = now(),
      stage = 'converted',
      profile_id = coalesce(profile_id, p_profile_id)
  where id = p_prospect_id;

  perform public.generate_conversion_commissions(v_member_id, coalesce(p_basis_amount, 500));

  return jsonb_build_object('member_id', v_member_id);
end;
$$;

revoke all on function public.convert_prospect_to_member(uuid, uuid, numeric) from public;
grant execute on function public.convert_prospect_to_member(uuid, uuid, numeric) to authenticated;
