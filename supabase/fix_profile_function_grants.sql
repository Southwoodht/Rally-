-- Rally — take anon back off the profile functions
--
-- RUN THIS ONE. It removes access; it does not add any.
--
-- WHY
--
-- The check on 2026-09-20 came back:
--
--     function,            authenticated_may_call, anon_may_call
--     public_player_card,  true,                   true
--
-- `anon` is the signed-out role. public_player_card() is security definer and
-- returns a person's record, form, recent matches and the names of their
-- opponents — so as it stands that is readable without an account at all.
--
-- CLAUDE.md §6 has asserted since 11 Sep that both new functions are "granted
-- to authenticated only, never anon". That was true of the file and false of
-- the database, and nobody had looked. The profiles-policy check a few days
-- ago asked the same question about a *table* and got a clean answer, which
-- is probably why the functions were never asked about.
--
-- HOW IT HAPPENED
--
-- Postgres grants EXECUTE on a new function to PUBLIC by default. The file
-- revokes it, at line 150 — thirty lines after the create. So a paste that
-- stops early, or an older run of the file from before the revoke existed,
-- leaves the function created and wide open, with no error anywhere and
-- nothing on screen that looks different.
--
-- That the revoke is missing is also evidence about the last paste: it
-- suggests the script did not run to the end. Which is worth knowing, because
-- public_league_snapshot did not appear in that output at all.

-- 1. Close it -------------------------------------------------------------
--
-- `from public` is the one that matters: anon and authenticated both inherit
-- from PUBLIC, so revoking from anon alone would leave the grant in place via
-- the PUBLIC role. Revoke from all three, then hand execute back to signed-in
-- accounts only.
revoke all on function public.public_player_card(uuid) from public;
revoke all on function public.public_player_card(uuid) from anon;
grant execute on function public.public_player_card(uuid) to authenticated;

-- Same treatment for the search function, which was never in the check but
-- was created by the same file on the same day and so has the same history.
revoke all on function public.search_player_accounts(text) from public;
revoke all on function public.search_player_accounts(text) from anon;
grant execute on function public.search_player_accounts(text) to authenticated;

-- 2. Prove it ------------------------------------------------------------
--
-- anon_may_call must be false on every row. authenticated_may_call must be
-- true on every row, or the app breaks for everybody.
select p.proname as function,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_may_call,
       has_function_privilege('anon', p.oid, 'execute')          as anon_may_call
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in (
     'public_player_card', 'search_player_accounts', 'public_league_snapshot',
     'global_standings', 'global_edges', 'nudge_match', 'level_val'
   )
 order by 1;
