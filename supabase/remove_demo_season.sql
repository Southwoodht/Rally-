-- Southwood — take the Test club's demo season back out (demo_test_club_season.sql).
-- Test club only: everything is found by the club name "Test Truman" plus the
-- demo markers (season "Winter 2026/27", groups "Winter 2026/27 · …", players
-- surnamed "Demo"). Deleting the players removes their matches, entries and
-- fixtures with them (on delete cascade). One transaction.
-- Expect: 0, 0, 0.

begin;
delete from public.doubles_competitions c using public.leagues l
 where l.id = c.league_id and trim(l.name) = 'Test Truman' and c.name like 'Winter 2026/27%';
delete from public.players p using public.leagues l
 where l.id = p.league_id and trim(l.name) = 'Test Truman' and p.last = 'Demo';
delete from public.seasons s using public.leagues l
 where l.id = s.league_id and trim(l.name) = 'Test Truman' and s.name = 'Winter 2026/27';
commit;

select
  (select count(*) from public.seasons s join public.leagues l on l.id = s.league_id where trim(l.name) = 'Test Truman' and s.name = 'Winter 2026/27') as seasons,
  (select count(*) from public.doubles_competitions c join public.leagues l on l.id = c.league_id where trim(l.name) = 'Test Truman' and c.name like 'Winter 2026/27%') as groups,
  (select count(*) from public.players p join public.leagues l on l.id = p.league_id where trim(l.name) = 'Test Truman' and p.last = 'Demo') as demo_players;
