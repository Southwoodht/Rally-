-- Southwood — remove Seacourt's "Test League" season.
-- CHANGES SEACOURT DATA: one row in public.seasons. Nothing else.
--
-- Sam, 2026-10-22: the season was only ever a tester, nobody in the club
-- knows about it, and James is getting a real winter season instead. Ending
-- it from the app would freeze a table, show a podium and POST THE WINNERS TO
-- THE SEACOURT FEED, so it is removed here instead, where nothing is posted.
--
-- What it does NOT touch: matches, players, fixtures, posts, competitions.
-- A season is only a date range; matches belong to the club. Any competition
-- that pointed at this season keeps everything and simply has no season
-- (season_id is "on delete set null"). With no season the Table opens on All
-- time and Home loses the season bar until the next one is started.
--
-- Back up first (backup_everything.sql). It refuses unless it finds exactly
-- one season called "Test League" in the club with join code WDZDTQ.
--
-- Then start the real one in the app: Run your club → Season.

do $$
declare n int;
begin
  select count(*) into n
  from public.seasons s join public.leagues l on l.id = s.league_id
  where l.join_code = 'WDZDTQ' and s.name = 'Test League';
  if n <> 1 then
    raise exception 'Expected exactly one "Test League" season in Seacourt, found %. Nothing was changed.', n;
  end if;

  delete from public.seasons s
  using public.leagues l
  where l.id = s.league_id and l.join_code = 'WDZDTQ' and s.name = 'Test League';
end $$;

-- Should come back: 0, 122
--   test_league_left  0    — the season is gone
--   seacourt_matches  122  — or more if results have been logged since; never fewer
select
  (select count(*) from public.seasons s join public.leagues l on l.id = s.league_id
    where l.join_code = 'WDZDTQ' and s.name = 'Test League') as test_league_left,
  (select count(*) from public.matches m join public.leagues l on l.id = m.league_id
    where l.join_code = 'WDZDTQ') as seacourt_matches;
