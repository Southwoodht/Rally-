-- Southwood — the data the rating fairness check runs on (brief item 3).
--
-- Reads only. One statement, one cell: every Seacourt player (with the level
-- history the ratings read) and every singles match, as JSON. Copy the cell
-- and paste it to Claude; it runs core/fairness.ts over it. Not for the repo:
-- it holds real names (same rule as backups/).

select json_build_object(
  'players', (select coalesce(json_agg(json_build_object(
      'id', p.id, 'name', trim(p.name), 'last', trim(p.last), 'inactive', p.inactive,
      'level', p.level, 'level_history', p.level_history,
      'level_estimate', p.level_estimate, 'level_estimate_history', p.level_estimate_history,
      'initial_record', p.initial_record, 'initial_elo', p.initial_elo)), '[]')
    from public.players p join public.leagues l on l.id = p.league_id
   where l.name ilike 'Seacourt%'),
  'matches', (select coalesce(json_agg(json_build_object(
      'id', m.id, 'p1', m.p1, 'p2', m.p2, 'winner', m.winner, 'score', m.score,
      'date', m.date, 'status', m.status, 'created_at', m.created_at) order by m.date), '[]')
    from public.matches m join public.leagues l on l.id = m.league_id
   where l.name ilike 'Seacourt%')
) as seacourt;
