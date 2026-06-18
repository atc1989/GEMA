-- GEMA Member Onboarding
-- Lets a signed-in user become an active member. RLS does not permit a normal
-- user to insert into members (only the admin policy does), so onboarding runs
-- through this SECURITY DEFINER routine, which acts on auth.uid().
--
-- Run once against the GEMA Supabase project (after schema.sql). Safe to re-run.

/*
 * onboard_member: idempotently creates an active member for the current user.
 * Optional sponsor attribution resolves p_sponsor_ref as either a referral
 * ref_code or an existing member username.
 *
 * Returns { member_id, member_code, username }.
 * Raises on: no session, username taken.
 */
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

  -- Idempotent: already a member → return it.
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

  -- Optional sponsor attribution (ref code first, then username).
  if p_sponsor_ref is not null and length(trim(p_sponsor_ref)) > 0 then
    select referrer_member_id into v_sponsor
    from public.referrals
    where ref_code = trim(p_sponsor_ref)
      and status in ('active', 'claimed')
    limit 1;

    if v_sponsor is null then
      select id into v_sponsor
      from public.members
      where username = trim(p_sponsor_ref)::citext
      limit 1;
    end if;
  end if;

  -- Unique member_code (retry on the rare collision).
  loop
    v_attempt := v_attempt + 1;
    v_code := 'M' || to_char(now(), 'YYMMDD') || upper(substr(md5(gen_random_uuid()::text), 1, 5));
    exit when not exists (select 1 from public.members where member_code = v_code);
    if v_attempt >= 8 then
      raise exception 'Could not allocate a member code, please retry';
    end if;
  end loop;

  insert into public.members (
    profile_id, sponsor_member_id, member_code, username, status,
    joined_at, activated_at
  )
  values (
    v_uid, v_sponsor, v_code, v_username, 'active', now(), now()
  )
  returning * into v_existing;

  return jsonb_build_object(
    'member_id', v_existing.id,
    'member_code', v_existing.member_code,
    'username', v_existing.username
  );
end;
$$;

revoke all on function public.onboard_member(text, text) from public;
grant execute on function public.onboard_member(text, text) to authenticated;
