-- Rally — close every app function to anon. Run after ANY migration.
--
-- Safe to run at any time, as often as you like. It only ever removes access
-- and re-grants signed-in accounts, so running it when nothing is wrong does
-- nothing at all.
--
-- WHY THIS HAS TO BE RUN AGAIN AND AGAIN
--
-- Supabase ships `alter default privileges in schema public grant all on
-- functions to anon, authenticated, service_role`. So **every newly created
-- function is callable by the signed-out role the moment it exists** — and a
-- `create or replace`, or a drop-and-recreate, counts as newly created.
--
-- The revoke at the bottom of most schema files says `from public`, which
-- removes a grant that was never the one carrying the access. It succeeds and
-- changes nothing. That is how six functions sat open from 4 September to 20
-- September with the correct-looking line in every file, and it is why
-- re-running schema_public_player_card.sql re-opens two of them every time.
--
-- Revoking from `public, anon` is what actually closes it.
--
-- THE TWO THAT ARE NOT HERE, AND MUST NOT BE ADDED
--
-- is_league_member and is_club_admin stay callable by anon on purpose. They
-- are not entry points — they are the predicates inside the row policies, and
-- is_league_member alone appears in fourteen `using` / `with check` clauses
-- across players, matches, fixtures and posts. A policy's function call is
-- made by the querying role, so revoking execute does not make those policies
-- evaluate false for a signed-out request: it makes them raise a permission
-- error, and every signed-out query against those tables starts failing
-- instead of returning no rows.
--
-- There is nothing to close on them either. Both resolve auth.uid() and both
-- answer a question about the caller — "am I in this league" — which signed
-- out is false and tells them nothing.

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.public_player_card(uuid)',
    'public.search_player_accounts(text)',
    'public.public_league_snapshot(uuid)',
    'public.set_player_level_estimate(text, jsonb, jsonb)',
    'public.global_standings()',
    'public.global_edges()',
    'public.nudge_match(text)',
    'public.level_val(jsonb)',
    'public.start_thread(uuid)',
    'public.unread_message_count()'
  ]
  loop
    -- A function that does not exist yet is skipped rather than failing the
    -- whole script — set_player_level_estimate and public_league_snapshot
    -- have each been absent at different points, and a hard error here would
    -- stop the run before closing the ones that do exist.
    begin
      execute format('revoke all on function %s from public, anon', fn);
      execute format('grant execute on function %s to authenticated', fn);
    exception when undefined_function then
      raise notice 'skipped (not created yet): %', fn;
    end;
  end loop;
end;
$$;

-- Expect anon_may_call false on everything EXCEPT is_league_member and
-- is_club_admin. A name missing from this list has not been created.
select f.proname                                 as function,
       pg_get_function_identity_arguments(f.oid) as takes,
       has_function_privilege('authenticated', f.oid, 'execute') as authenticated_may_call,
       has_function_privilege('anon', f.oid, 'execute')          as anon_may_call
  from pg_proc f join pg_namespace n on n.oid = f.pronamespace
 where n.nspname = 'public'
   and f.proname in (
     'public_player_card', 'search_player_accounts', 'public_league_snapshot',
     'set_player_level_estimate', 'global_standings', 'global_edges',
     'nudge_match', 'level_val', 'start_thread', 'unread_message_count',
     'is_league_member', 'is_club_admin'
   )
 order by 1;
