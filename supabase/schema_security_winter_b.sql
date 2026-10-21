-- Southwood — security fix B (winter pilot, 2026-10-21).
--
-- RUN ONLY AFTER the winter-pilot code is live on master. The app on master
-- before then finds a club by reading `leagues` directly, which this file
-- stops; run it early and nobody can join a club by code until the deploy.
-- The winter-pilot app asks find_league_by_code() first and only falls back
-- to the direct read when that function is missing, so it works before AND
-- after this file.
--
-- Back up first (backup_everything.sql). Then run fix_function_grants.sql.
-- Changes rules only; touches no row. Safe to re-run.
--
-- WHAT IT CLOSES: "find a league by its code" was `using (true)` with no
-- role named, so every club's name, location and JOIN CODE was readable by
-- anyone — signed in or not. With the code, anyone could join any club as a
-- member and read its players and results. Now a code is looked up through
-- one function that returns the one club matching it, to a signed-in
-- caller only; you still need the code to find anything, which is what a
-- code is for.

create or replace function public.find_league_by_code(p_code text)
returns table (id uuid, name text, location text, join_code text, created_by uuid)
language sql
security definer
stable
set search_path = public
as $$
  select l.id, l.name, l.location, l.join_code, l.created_by
    from public.leagues l
   where auth.uid() is not null
     and l.join_code = upper(trim(p_code))
   limit 1;
$$;

revoke all on function public.find_league_by_code(text) from public, anon;
grant execute on function public.find_league_by_code(text) to authenticated;

drop policy if exists "find a league by its code" on public.leagues;

-- Expect: 0, true, false.
--   open_policy      the read-everything rule is gone
--   finder_exists    the lookup function is installed
--   anon_may_call    a signed-out visitor cannot call it
select
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'leagues'
     and policyname = 'find a league by its code') as open_policy,
  exists (select 1 from pg_proc where proname = 'find_league_by_code') as finder_exists,
  has_function_privilege('anon', 'public.find_league_by_code(text)', 'execute') as anon_may_call;
