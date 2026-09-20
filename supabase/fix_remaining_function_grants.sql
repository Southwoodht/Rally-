-- Rally — the other four functions anon can call
--
-- RUN THIS ONE. It removes access; it adds none.
--
-- READ THIS FIRST, because the headline is smaller than it looks:
--
--     global_edges       anon: true
--     global_standings   anon: true
--     level_val          anon: true
--     nudge_match        anon: true
--
-- **None of these four leak anything.** That is not a guess, it is how each
-- one is written:
--
--   global_standings and global_edges both filter through is_league_member(),
--   which reads auth.uid(). A signed-out caller has none, so no league is
--   visible and they get zero rows — the same reason §6 records for these
--   returning nothing in the Supabase SQL editor.
--
--   nudge_match resolves the caller to a player row by auth.uid() before it
--   will write. With no auth.uid() that check fails and it raises "Only
--   whoever logged this result can nudge about it." It cannot write.
--
--   level_val takes a jsonb and returns an int. It reads no table at all.
--
-- So this is not the same event as public_player_card, which genuinely was
-- returning people's records and their opponents' names to signed-out
-- callers. That one was an exposure and is now closed. These four are
-- defence in depth — with one exception worth naming:
--
-- **nudge_match is an existence oracle.** Its two refusals differ: "No such
-- match." for an id that does not exist, and "Only whoever logged this
-- result can nudge about it." for one that does. A signed-out caller can
-- therefore test whether a given match id is real. Match ids are not
-- guessable and this is a small thing, but it is a real difference between
-- "returns nothing" and "tells you nothing", and it is a write function
-- reachable without an account, which it should not be either way.

-- Revoke from PUBLIC, not from anon. Both anon and authenticated inherit
-- from PUBLIC, so revoking anon alone leaves the grant standing through the
-- role it inherits from — which is exactly how all of these came to be open:
-- Postgres grants EXECUTE on a new function to PUBLIC by default.
revoke all on function public.global_standings() from public, anon;
grant execute on function public.global_standings() to authenticated;

revoke all on function public.global_edges() from public, anon;
grant execute on function public.global_edges() to authenticated;

revoke all on function public.nudge_match(text) from public, anon;
grant execute on function public.nudge_match(text) to authenticated;

-- level_val is called inside global_standings, which is security definer and
-- therefore runs as its owner — so narrowing this does not affect it.
revoke all on function public.level_val(jsonb) from public, anon;
grant execute on function public.level_val(jsonb) to authenticated;

-- Prove it. Every anon_may_call must be false; every authenticated_may_call
-- must stay true, or the app breaks for everybody who is signed in.
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
