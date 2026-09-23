-- Rally — is the database ready for a match outside a league?
--
-- READ ONLY. One statement, no auth.uid() — see §6.
--
-- WHY THIS IS NEEDED BEFORE ANY CODE IS WRITTEN
--
-- Sam, 2026-09-23: on the test account there is no way to add a match with
-- an existing player when the two of you share no league.
--
-- The app half of that is certain and does not need a query: in Friendlies
-- the roster is `select * from players where league_id is null`, so the only
-- people offered are other league-less shells. Anybody who belongs to a
-- league — which is everybody in Seacourt — is simply not in the list.
--
-- The DATABASE half is not certain, and guessing it is how an evening gets
-- lost. Three migrations in supabase/ each unlock part of this and CLAUDE.md
-- records only some of them as run:
--
--   schema_friendly_players.sql    players.league_id nullable      RUN 12 Sep
--   schema_match_bookings.sql      matches.league_id nullable,     UNRECORDED
--                                  winner nullable, and the
--                                  participant read/insert paths
--   schema_friendly_fixtures.sql   fixtures.league_id nullable     RECORDED AS
--                                                                  WAITING
--
-- A file in supabase/ is not run just because the feature reading it is
-- deployed — §6 says so, and it cost a fortnight of an inert Claim-a-trophy
-- form once already. So: ask.
--
-- WHAT TO LOOK FOR
--
--   is_nullable = YES on matches.league_id and matches.winner  -> bookings ran
--   is_nullable = YES on fixtures.league_id                    -> fixtures ran
--   the two matches policies mentioning `league_id is null`    -> the
--     participant paths exist, which is what lets you log a match against
--     somebody you share no league with
--
-- Anything reading NO or missing is a migration to run before the feature can
-- work, and I will say which.

select 'column' as kind,
       t.table_name || '.' || t.column_name as name,
       t.is_nullable                        as nullable_or_cmd,
       ''                                   as detail
  from information_schema.columns t
 where t.table_schema = 'public'
   and (t.table_name, t.column_name) in (
         ('players', 'league_id'), ('players', 'created_by'),
         ('matches', 'league_id'), ('matches', 'winner'),
         ('fixtures', 'league_id')
       )

union all

select 'policy',
       p.tablename || ' :: ' || p.policyname,
       p.cmd,
       case when coalesce(p.qual, '') || coalesce(p.with_check, '') like '%league_id IS NULL%'
            then 'has the league-less branch'
            else 'league-only' end
  from pg_policies p
 where p.schemaname = 'public'
   and p.tablename in ('matches', 'fixtures', 'players')

 order by 1, 2;
