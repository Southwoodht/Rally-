-- Rally — the last two, and the two that must be left alone
--
-- RUN THIS ONE. It closes two functions and deliberately does not touch the
-- other two, for a reason worth reading before anybody "finishes the job".
--
-- After the previous two fixes, four functions still answer anon:
--
--     is_club_admin(c_id uuid)     LEAVE OPEN — see below
--     is_league_member(l_id uuid)  LEAVE OPEN — see below
--     start_thread(other_id uuid)  closed here
--     unread_message_count()       closed here
--
-- WHY is_league_member AND is_club_admin STAY
--
-- They are not app entry points. They are the predicates inside the row
-- policies — is_league_member alone appears in fourteen `using` / `with
-- check` clauses across players, matches, fixtures and posts.
--
-- A policy's function call is made by the *querying* role. So revoking
-- execute from anon does not make those policies return false for a
-- signed-out request; it makes them **raise a permission error**. Every
-- signed-out query against those tables would stop returning "no rows" and
-- start returning a failure, which is a worse outcome than the thing being
-- tidied.
--
-- And there is nothing to tidy. Both are security definer, both resolve
-- auth.uid(), and both answer a question about the caller themselves:
-- "am I in this league", "am I an admin of this club". A signed-out caller
-- gets false, which they already knew. Nothing about anybody else is
-- reachable through either.
--
-- This is the exception to "revoke anon from everything", and it is the kind
-- of exception that takes an app down when applied by pattern.

-- start_thread is a write — it creates a message thread. It already refuses a
-- signed-out caller outright ("Not signed in.") so nothing was reachable, but
-- a write function should not be callable without an account regardless.
revoke all on function public.start_thread(uuid) from public, anon;
grant execute on function public.start_thread(uuid) to authenticated;

-- unread_message_count resolves auth.uid() and would return 0 for a
-- signed-out caller. Closed for the same reason: no reason to be open.
revoke all on function public.unread_message_count() from public, anon;
grant execute on function public.unread_message_count() to authenticated;

-- Prove it, and show what is still missing entirely ------------------------
--
-- Expected after this runs: anon_may_call false on everything EXCEPT
-- is_league_member and is_club_admin, which must stay true.
--
-- Note which names do not come back at all. public_league_snapshot has been
-- absent from every report so far — it has never been created, and that is
-- the whole of the restricted profile. set_player_level_estimate will also be
-- absent until schema_level_estimate.sql is run.
select p.proname                                 as function,
       pg_get_function_identity_arguments(p.oid) as takes,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_may_call,
       has_function_privilege('anon', p.oid, 'execute')          as anon_may_call
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in (
     'public_player_card', 'search_player_accounts', 'public_league_snapshot',
     'global_standings', 'global_edges', 'nudge_match', 'level_val',
     'is_league_member', 'is_club_admin', 'start_thread', 'unread_message_count',
     'set_player_level_estimate'
   )
 order by 1;
