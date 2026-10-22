-- Southwood — demo season for the TEST CLUB ONLY ("Test Truman"), 2026-10-22.
--
-- Sam asked for it: "Winter 2026/27", 1 Nov – 31 Mar, two round-robin groups
-- of test players playing each other twice, play-by dates, and a few results
-- so it looks alive. Generated from the app's own roundRobin and
-- roundDeadlines, so it is exactly what the app would have drawn.
--
-- Every player is a shell with surname "Demo" (no account, so no emails),
-- and remove_demo_season.sql takes all of it out again. It refuses to run if
-- it can't find exactly one club called "Test Truman", if that club is
-- Seacourt, or if the club already has a running season. One transaction.
-- Results are dated today (22 Oct): they count in the group tables now, and
-- not on the season table until the season starts on 1 Nov.

begin;
do $$
declare
  lid uuid;
  n int;
  sea uuid := gen_random_uuid();
  comp0 uuid := gen_random_uuid();
  comp1 uuid := gen_random_uuid();
begin
  select count(*) into n from public.leagues where trim(name) = 'Test Truman';
  if n <> 1 then raise exception 'Expected exactly one club called Test Truman, found %', n; end if;
  select id into lid from public.leagues where trim(name) = 'Test Truman';
  if exists (select 1 from public.leagues where id = lid and name ilike '%seacourt%') then raise exception 'Refusing: that is Seacourt'; end if;
  if exists (select 1 from public.seasons where league_id = lid and status = 'active') then raise exception 'The Test club already has a running season — end it first'; end if;

  insert into public.seasons (id, league_id, name, starts_on, ends_on, status) values (sea, lid, 'Winter 2026/27', '2026-11-01', '2027-03-31', 'active');

  -- Winter 2026/27 · Group A
  insert into public.players (id, league_id, name, last, level, level_history) values ('e7hts822', lid, 'Ava', 'Demo', '{"cat":"Intermediate","sub":"High"}'::jsonb, '[{"cat":"Intermediate","sub":"High","from":"2026-10","to":null}]'::jsonb);
  insert into public.players (id, league_id, name, last, level, level_history) values ('rrpjkl1x', lid, 'Ben', 'Demo', '{"cat":"Intermediate","sub":"Medium"}'::jsonb, '[{"cat":"Intermediate","sub":"Medium","from":"2026-10","to":null}]'::jsonb);
  insert into public.players (id, league_id, name, last, level, level_history) values ('d4f99b1s', lid, 'Cara', 'Demo', '{"cat":"Intermediate","sub":"Medium"}'::jsonb, '[{"cat":"Intermediate","sub":"Medium","from":"2026-10","to":null}]'::jsonb);
  insert into public.players (id, league_id, name, last, level, level_history) values ('vl2ybq89', lid, 'Dan', 'Demo', '{"cat":"Intermediate","sub":"Low"}'::jsonb, '[{"cat":"Intermediate","sub":"Low","from":"2026-10","to":null}]'::jsonb);
  insert into public.doubles_competitions (id, league_id, name, format, legs, points_win, points_draw, status, kind, season_id) values (comp0, lid, 'Winter 2026/27 · Group A', 'league', 2, 3, 1, 'running', 'singles', sea);
  insert into public.doubles_competition_pairs (competition_id, p1, p2, seed) values (comp0, 'e7hts822', null, 1);
  insert into public.doubles_competition_pairs (competition_id, p1, p2, seed) values (comp0, 'rrpjkl1x', null, 2);
  insert into public.doubles_competition_pairs (competition_id, p1, p2, seed) values (comp0, 'd4f99b1s', null, 3);
  insert into public.doubles_competition_pairs (competition_id, p1, p2, seed) values (comp0, 'vl2ybq89', null, 4);
  insert into public.matches (id, league_id, p1, p2, date, winner, score, status) values ('wb96tj5p', lid, 'e7hts822', 'vl2ybq89', '2026-10-22T12:00:00Z', 'p1', '6-3, 6-4', 'confirmed');
  insert into public.fixtures (id, league_id, p1, p2, done, winner, match_id, competition_id, round, play_by) values ('4pjunh8x', lid, 'e7hts822', 'vl2ybq89', true, 'p1', 'wb96tj5p', comp0, 1, '2026-11-26');
  insert into public.matches (id, league_id, p1, p2, date, winner, score, status) values ('o7b1q5kz', lid, 'rrpjkl1x', 'd4f99b1s', '2026-10-22T12:00:00Z', 'p2', '4-6, 6-2, 6-7', 'confirmed');
  insert into public.fixtures (id, league_id, p1, p2, done, winner, match_id, competition_id, round, play_by) values ('t8blu0pd', lid, 'rrpjkl1x', 'd4f99b1s', true, 'p2', 'o7b1q5kz', comp0, 1, '2026-11-26');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('y0a4xs8s', lid, 'd4f99b1s', 'e7hts822', false, comp0, 2, '2026-12-21');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('eq0qgy9h', lid, 'vl2ybq89', 'rrpjkl1x', false, comp0, 2, '2026-12-21');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('23afwmew', lid, 'e7hts822', 'rrpjkl1x', false, comp0, 3, '2027-01-15');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('m6refwef', lid, 'd4f99b1s', 'vl2ybq89', false, comp0, 3, '2027-01-15');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('40xwrfud', lid, 'vl2ybq89', 'e7hts822', false, comp0, 4, '2027-02-09');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('e08qtfmj', lid, 'd4f99b1s', 'rrpjkl1x', false, comp0, 4, '2027-02-09');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('jeap7f2j', lid, 'e7hts822', 'd4f99b1s', false, comp0, 5, '2027-03-06');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('gao7g83u', lid, 'rrpjkl1x', 'vl2ybq89', false, comp0, 5, '2027-03-06');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('mlf3xg5o', lid, 'rrpjkl1x', 'e7hts822', false, comp0, 6, '2027-03-31');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('27dpf9yy', lid, 'vl2ybq89', 'd4f99b1s', false, comp0, 6, '2027-03-31');

  -- Winter 2026/27 · Group B
  insert into public.players (id, league_id, name, last, level, level_history) values ('jzr02wzw', lid, 'Eve', 'Demo', '{"cat":"Amateur","sub":"High"}'::jsonb, '[{"cat":"Amateur","sub":"High","from":"2026-10","to":null}]'::jsonb);
  insert into public.players (id, league_id, name, last, level, level_history) values ('m9u13cij', lid, 'Finn', 'Demo', '{"cat":"Amateur","sub":"High"}'::jsonb, '[{"cat":"Amateur","sub":"High","from":"2026-10","to":null}]'::jsonb);
  insert into public.players (id, league_id, name, last, level, level_history) values ('2qweafnh', lid, 'Gus', 'Demo', '{"cat":"Amateur","sub":"Medium"}'::jsonb, '[{"cat":"Amateur","sub":"Medium","from":"2026-10","to":null}]'::jsonb);
  insert into public.players (id, league_id, name, last, level, level_history) values ('guj3j191', lid, 'Hana', 'Demo', '{"cat":"Amateur","sub":"Medium"}'::jsonb, '[{"cat":"Amateur","sub":"Medium","from":"2026-10","to":null}]'::jsonb);
  insert into public.players (id, league_id, name, last, level, level_history) values ('n9jbwnsr', lid, 'Ian', 'Demo', '{"cat":"Amateur","sub":"Low"}'::jsonb, '[{"cat":"Amateur","sub":"Low","from":"2026-10","to":null}]'::jsonb);
  insert into public.doubles_competitions (id, league_id, name, format, legs, points_win, points_draw, status, kind, season_id) values (comp1, lid, 'Winter 2026/27 · Group B', 'league', 2, 3, 1, 'running', 'singles', sea);
  insert into public.doubles_competition_pairs (competition_id, p1, p2, seed) values (comp1, 'jzr02wzw', null, 1);
  insert into public.doubles_competition_pairs (competition_id, p1, p2, seed) values (comp1, 'm9u13cij', null, 2);
  insert into public.doubles_competition_pairs (competition_id, p1, p2, seed) values (comp1, '2qweafnh', null, 3);
  insert into public.doubles_competition_pairs (competition_id, p1, p2, seed) values (comp1, 'guj3j191', null, 4);
  insert into public.doubles_competition_pairs (competition_id, p1, p2, seed) values (comp1, 'n9jbwnsr', null, 5);
  insert into public.matches (id, league_id, p1, p2, date, winner, score, status) values ('8qj8slgr', lid, 'm9u13cij', 'n9jbwnsr', '2026-10-22T12:00:00Z', 'p1', '6-1, 6-2', 'confirmed');
  insert into public.fixtures (id, league_id, p1, p2, done, winner, match_id, competition_id, round, play_by) values ('6f3sregr', lid, 'm9u13cij', 'n9jbwnsr', true, 'p1', '8qj8slgr', comp1, 1, '2026-11-16');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('561s83ov', lid, '2qweafnh', 'guj3j191', false, comp1, 1, '2026-11-16');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('c9o9ly6o', lid, 'n9jbwnsr', 'jzr02wzw', false, comp1, 2, '2026-12-01');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('rjcimwm6', lid, 'm9u13cij', '2qweafnh', false, comp1, 2, '2026-12-01');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('7v4ppj5y', lid, 'jzr02wzw', 'guj3j191', false, comp1, 3, '2026-12-16');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('y9ucu977', lid, 'n9jbwnsr', '2qweafnh', false, comp1, 3, '2026-12-16');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('dlnrw5ea', lid, '2qweafnh', 'jzr02wzw', false, comp1, 4, '2026-12-31');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('vkjjcft4', lid, 'guj3j191', 'm9u13cij', false, comp1, 4, '2026-12-31');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('u7wwvhij', lid, 'jzr02wzw', 'm9u13cij', false, comp1, 5, '2027-01-15');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('88uppw4o', lid, 'guj3j191', 'n9jbwnsr', false, comp1, 5, '2027-01-15');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('8r49ocbm', lid, 'n9jbwnsr', 'm9u13cij', false, comp1, 6, '2027-01-30');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('pnqen70p', lid, 'guj3j191', '2qweafnh', false, comp1, 6, '2027-01-30');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('zdzwhpev', lid, 'jzr02wzw', 'n9jbwnsr', false, comp1, 7, '2027-02-14');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('kiglrpjn', lid, '2qweafnh', 'm9u13cij', false, comp1, 7, '2027-02-14');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('ulzzzf1j', lid, 'guj3j191', 'jzr02wzw', false, comp1, 8, '2027-03-01');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('xlynh2kn', lid, '2qweafnh', 'n9jbwnsr', false, comp1, 8, '2027-03-01');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('yxobkoa6', lid, 'jzr02wzw', '2qweafnh', false, comp1, 9, '2027-03-16');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('cbf902y9', lid, 'm9u13cij', 'guj3j191', false, comp1, 9, '2027-03-16');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('smb6eivb', lid, 'm9u13cij', 'jzr02wzw', false, comp1, 10, '2027-03-31');
  insert into public.fixtures (id, league_id, p1, p2, done, competition_id, round, play_by) values ('0bqib12z', lid, 'n9jbwnsr', 'guj3j191', false, comp1, 10, '2027-03-31');
end;
$$;
commit;

-- Proves it. Expect: 1, 2, 9, 32, 3.
select
  (select count(*) from public.seasons s join public.leagues l on l.id = s.league_id where trim(l.name) = 'Test Truman' and s.name = 'Winter 2026/27') as seasons,
  (select count(*) from public.doubles_competitions c join public.leagues l on l.id = c.league_id where trim(l.name) = 'Test Truman' and c.name like 'Winter 2026/27%') as groups,
  (select count(*) from public.players p join public.leagues l on l.id = p.league_id where trim(l.name) = 'Test Truman' and p.last = 'Demo') as demo_players,
  (select count(*) from public.fixtures f join public.doubles_competitions c on c.id = f.competition_id where c.name like 'Winter 2026/27%') as ties,
  (select count(*) from public.fixtures f join public.doubles_competitions c on c.id = f.competition_id where c.name like 'Winter 2026/27%' and f.done) as results;
