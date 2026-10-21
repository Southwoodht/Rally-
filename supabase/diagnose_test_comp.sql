-- Southwood — which Seacourt matches came from Sam's "Test comp" (2026-10-21).
-- Read-only. One statement, so the editor shows it all.
--
-- Every Seacourt match logged today, with in_test_comp saying whether a
-- "Test comp" fixture points at it — so a test entered some other way is on
-- the list too, and a real result from today can be told apart.

select
  m.id,
  coalesce(p1.name || ' ' || coalesce(p1.last, ''), m.p1) as player_1,
  coalesce(p2.name || ' ' || coalesce(p2.last, ''), m.p2) as player_2,
  m.winner,
  m.score,
  m.status,
  m.created_at,
  exists (
    select 1
      from public.fixtures f
      join public.doubles_competitions c on c.id = f.competition_id
     where f.match_id = m.id and c.name ilike 'test comp%'
  ) as in_test_comp
from public.matches m
join public.leagues l on l.id = m.league_id
left join public.players p1 on p1.id = m.p1
left join public.players p2 on p2.id = m.p2
where l.name ilike 'seacourt%'
  and m.created_at >= '2026-10-21'
order by m.created_at;
