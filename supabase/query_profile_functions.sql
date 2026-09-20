-- Rally — which profile functions are actually installed, and which version
--
-- READ ONLY. Nothing is written. Safe to run any time.
--
-- Paste the output back. "Doesn't seem to work" has three possible causes and
-- this tells them apart in one go:
--
--   1. the function is not there at all
--   2. it is there but is the older version, missing the columns the app
--      needs (opponent_id and opponent_avatar are the tappable opponents and
--      their avatars)
--   3. it is there and current, and the problem is somewhere else entirely
--
-- Case 2 is the awkward one, because an old version does not error. It
-- returns rows that parse perfectly and are simply missing things, which is
-- why this looked like a permissions problem rather than a stale function.

-- 1. Do they exist, and what do they return? ------------------------------
--
-- The result type lists every column by name, so you can see at a glance
-- whether public_player_card has opponent_id in it. If a row is missing from
-- this output entirely, that function has never been created.
select p.proname                                   as function,
       pg_get_function_identity_arguments(p.oid)   as takes,
       pg_get_function_result(p.oid)               as returns
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('public_player_card', 'public_league_snapshot')
 order by 1;

-- 2. Who is allowed to call them? -----------------------------------------
--
-- Both must be executable by `authenticated`. A function that exists but was
-- never granted behaves, from the app, exactly like one that does not.
select p.proname as function,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_may_call,
       has_function_privilege('anon', p.oid, 'execute')          as anon_may_call
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('public_player_card', 'public_league_snapshot')
 order by 1;

-- 3. If both look right, wake PostgREST up ---------------------------------
--
-- Supabase's API layer caches the list of callable functions. It usually
-- refreshes on its own within a few seconds of a migration, but when it has
-- not, a brand new function reads as "Could not find the function" from the
-- app while looking perfectly present here. This is safe to run at any time
-- and costs nothing.
notify pgrst, 'reload schema';
