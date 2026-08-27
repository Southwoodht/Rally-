-- Rally — scope shared_storage RLS to league membership
--
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
--
-- The original policy on shared_storage was "any signed-in user can read
-- or write ANY row" — meaning any member of any league could read or
-- overwrite another league's entire players/matches/settings blob, not
-- just their own. This scopes every read/write to rows that belong to a
-- league the requesting user is actually a member of.
--
-- Safe to run any time: it only narrows access. Legitimate members of a
-- league keep working exactly as before; nobody else gets in. It does not
-- touch leagues, league_members, or any other table, and it doesn't
-- delete or move any data.
--
-- shared_storage has no league_id column of its own — league membership
-- has to be derived from the key, which is always "<prefix>_<league-uuid>"
-- (grpc5_..., settings_..., groups_...). Rows whose key doesn't parse into
-- a real league uuid (leftover/dev keys like "settings_c5" or
-- "grpc5_g_debug") become unreachable under this policy — that's correct,
-- since those were never real league data.

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
  return null;
exception when others then
  return null;
end;
$$;

drop policy if exists "any signed in user can read shared storage" on public.shared_storage;
drop policy if exists "any signed in user can write shared storage" on public.shared_storage;
drop policy if exists "any signed in user can update shared storage" on public.shared_storage;
drop policy if exists "any signed in user can delete shared storage" on public.shared_storage;

create policy "league members can read their league's shared storage"
  on public.shared_storage for select
  using (public.is_league_member(public.shared_storage_league_id(key)));

create policy "league members can write their league's shared storage"
  on public.shared_storage for insert
  with check (public.is_league_member(public.shared_storage_league_id(key)));

create policy "league members can update their league's shared storage"
  on public.shared_storage for update
  using (public.is_league_member(public.shared_storage_league_id(key)));

create policy "league members can delete their league's shared storage"
  on public.shared_storage for delete
  using (public.is_league_member(public.shared_storage_league_id(key)));

-- Verify after running: as a signed-in member of your league, the app
-- should load and save exactly as before. If you have access to a second
-- test account that is NOT a member of your league, confirm it can no
-- longer read your league's shared_storage rows via the API directly.
