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
    'public.unread_message_count()',
    -- Club lookup by join code (schema_security_winter_b.sql). An entry point,
    -- so closed to anon like the rest; skipped until that file has run.
    'public.find_league_by_code(text)',
    -- Seasons (schema_seasons.sql): closing a season is an entry point; the
    -- fixture guard is a trigger function, revocable like the doubles ones.
    'public.close_season_if_due(uuid)',
    'public.guard_competition_fixture()',
    -- Levels (schema_levels_organisers.sql): the organiser door, and the two
    -- trigger functions behind it.
    'public.set_player_level(text, jsonb, jsonb)',
    'public.guard_player_level()',
    'public.log_player_level()',
    -- Starting rating and record (schema_starting_record_organisers.sql).
    'public.set_player_start(text, numeric, jsonb)',
    -- A player's UTR (schema_player_utr.sql).
    'public.set_player_utr(text, numeric)',
    -- A club logo (schema_club_logo.sql).
    'public.set_league_logo(uuid, text)',
    -- Where a club is (schema_club_location.sql).
    'public.set_league_place(uuid, text, double precision, double precision)',
    'public.set_league_open(uuid, boolean)',
    'public.clubs_near(double precision, double precision, double precision)',
    'public.players_near(uuid[], double precision, double precision)',
    -- Moderation (schema_moderation.sql): renaming a player, removing a member.
    'public.set_player_name(text, text, text)',
    'public.remove_league_member(uuid, uuid)',
    -- The doubles sanity trigger's function (schema_doubles.sql). Not an
    -- entry point — nothing calls it but the trigger — and the migration
    -- revokes it itself. It is listed anyway because `create or replace`
    -- counts as newly created, so a re-run of that file re-opens it to anon
    -- exactly as re-running schema_public_player_card.sql re-opens two
    -- others. A function closed once and left off this list is a function
    -- that quietly reopens.
    --
    -- Safe to revoke even though a trigger fires it: Postgres checks EXECUTE
    -- on a trigger function when the trigger is CREATED, not each time it
    -- fires. That is what makes this different from is_league_member, which
    -- is evaluated per query by the querying role and must stay open.
    'public.doubles_match_is_sane()',
    'public.doubles_fixture_is_sane()'
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
     'find_league_by_code',
     'close_season_if_due', 'guard_competition_fixture',
     'set_player_level', 'guard_player_level', 'log_player_level', 'set_player_start', 'set_player_utr', 'set_league_logo',
     'set_league_place', 'set_league_open', 'clubs_near', 'players_near',
     'set_player_name', 'remove_league_member',
     'doubles_match_is_sane', 'doubles_fixture_is_sane',
     'is_league_member', 'is_club_admin'
   )
 order by 1;
