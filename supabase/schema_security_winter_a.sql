-- Southwood — security fix A (winter pilot, 2026-10-21). SAFE TO RUN NOW.
--
-- Back up first: supabase/backup_everything.sql.
--
-- Changes rules only. Touches no row. Safe to re-run. Then run
-- fix_function_grants.sql, as after every migration (§6).
--
-- WHAT IT CLOSES
--
-- 1. shared_storage — the per-club settings store, which holds each club's
--    season, name and setup ("groups_<club>"), its table settings
--    ("settings_<club>") and its weekly rank snapshots
--    ("league:<club>:rankSnapshots"). schema.sql let ANY signed-in account
--    read, change or delete ANY row, from any club. A fix scoped it to club
--    members (schema_shared_storage_rls.sql) but nothing records it being
--    run, and even that version let any member — not just organisers —
--    rewrite the season, and it could not read the rank-snapshot key at all.
--    Now:
--      * read: members of that club;
--      * groups_ and the legacy grpc5_ blob: owner and organisers only;
--      * settings_ and rank snapshots: any member of that club, because
--        every member's app writes them (onboarding and the weekly
--        movement arrows) — but never anybody outside the club;
--      * any other key (old dev leftovers): nobody.
--
-- 2. league_members — "join a league as yourself" checked WHO you added but
--    not WHAT ROLE, so any signed-in account could insert itself into any
--    club as 'owner' and then delete its results. Combined with leagues
--    being readable by anyone (fix B), every club was one request from being
--    taken over. Now you may add yourself as a plain member, or as owner
--    only of a club you created yourself (which is what creating a club
--    does). Organisers are still made through set_league_role(), unchanged.
--
-- WHAT IT DOES NOT CHANGE
--   Nothing in the app needs to change for this to work: every write the
--   app makes is one these rules allow for the person making it.

-- ------------------------------------------------------------------ helpers

-- Owner or organiser of a club. Security definer, like is_league_member,
-- because it is a predicate inside row policies and must read
-- league_members whatever the caller can see. Like is_league_member it must
-- stay executable by the querying role (§6: revoking execute from a policy
-- predicate makes the policy raise instead of refuse), so it is NOT in
-- fix_function_grants.sql. It answers a question about the caller only.
create or replace function public.is_league_staff(l_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.league_members
     where league_id = l_id and user_id = auth.uid() and role in ('owner', 'editor')
  );
$$;

-- Which club a settings key belongs to, or null. Extends the version in
-- schema_shared_storage_rls.sql with the rank-snapshot key.
create or replace function public.shared_storage_league_id(k text)
returns uuid
language plpgsql
immutable
as $$
declare
  suffix text;
begin
  if k ~ '^(grpc5_|settings_|groups_)' then
    suffix := regexp_replace(k, '^(grpc5_|settings_|groups_)', '');
    return suffix::uuid;
  end if;
  if k ~ '^league:[0-9a-fA-F-]{36}:' then
    return substring(k from 8 for 36)::uuid;
  end if;
  return null;
exception when others then
  return null;
end;
$$;

-- --------------------------------------------------------- shared_storage

-- Every name either earlier file used, so this works whichever was run.
drop policy if exists "any signed in user can read shared storage" on public.shared_storage;
drop policy if exists "any signed in user can write shared storage" on public.shared_storage;
drop policy if exists "any signed in user can update shared storage" on public.shared_storage;
drop policy if exists "any signed in user can delete shared storage" on public.shared_storage;
drop policy if exists "league members can read their league's shared storage" on public.shared_storage;
drop policy if exists "league members can write their league's shared storage" on public.shared_storage;
drop policy if exists "league members can update their league's shared storage" on public.shared_storage;
drop policy if exists "league members can delete their league's shared storage" on public.shared_storage;
drop policy if exists "club members read their club's settings" on public.shared_storage;
drop policy if exists "club settings: members write their own, organisers the setup" on public.shared_storage;
drop policy if exists "club settings: update" on public.shared_storage;
drop policy if exists "club settings: delete" on public.shared_storage;

create policy "club members read their club's settings"
  on public.shared_storage for select
  using (public.is_league_member(public.shared_storage_league_id(key)));

-- The write rule, spelled the same way four times: a member of the club the
-- key belongs to, and for the setup/season blob an organiser.
create policy "club settings: members write their own, organisers the setup"
  on public.shared_storage for insert
  with check (
    public.is_league_member(public.shared_storage_league_id(key))
    and (key !~ '^(groups_|grpc5_)' or public.is_league_staff(public.shared_storage_league_id(key)))
  );

create policy "club settings: update"
  on public.shared_storage for update
  using (
    public.is_league_member(public.shared_storage_league_id(key))
    and (key !~ '^(groups_|grpc5_)' or public.is_league_staff(public.shared_storage_league_id(key)))
  )
  with check (
    public.is_league_member(public.shared_storage_league_id(key))
    and (key !~ '^(groups_|grpc5_)' or public.is_league_staff(public.shared_storage_league_id(key)))
  );

create policy "club settings: delete"
  on public.shared_storage for delete
  using (
    public.is_league_member(public.shared_storage_league_id(key))
    and (key !~ '^(groups_|grpc5_)' or public.is_league_staff(public.shared_storage_league_id(key)))
  );

-- --------------------------------------------------------- league_members

drop policy if exists "join a league as yourself" on public.league_members;
create policy "join a league as yourself"
  on public.league_members for insert
  with check (
    user_id = auth.uid()
    and (
      role = 'member'
      or (role = 'owner' and exists (
        select 1 from public.leagues l where l.id = league_id and l.created_by = auth.uid()
      ))
    )
  );

-- Proves the change, not its surroundings. Expect: 4, 0, true.
--   new_storage_policies  the four new shared_storage rules exist
--   open_storage_policies no "any signed in user" rule is left
--   join_checks_role      the join rule now names the role
select
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'shared_storage'
     and policyname in ('club members read their club''s settings',
                        'club settings: members write their own, organisers the setup',
                        'club settings: update', 'club settings: delete')) as new_storage_policies,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'shared_storage'
     and policyname like 'any signed in user%') as open_storage_policies,
  (select coalesce(with_check, '') like '%role%' from pg_policies
     where schemaname = 'public' and tablename = 'league_members'
       and policyname = 'join a league as yourself') as join_checks_role;
