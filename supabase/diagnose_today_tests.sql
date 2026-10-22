-- Southwood — what was logged in Seacourt on 22 Oct 2026 (brief-2, item 1).
-- Read-only. One statement.
--
-- Every Seacourt match logged today, with:
--   charlie_beat_sam  the test results Sam described (Charlie Henry, player id
--                     'charlie', beating Samuel Henry, '96zp33j8') — matched
--                     by ID, never by name: there are two Charlies.
--   linked_fixture    a fixture or competition tie it settled, which deleting
--                     the match would leave marked "done" unless reopened.
--   status            pending ones are already counting in the table.

select
  m.id,
  p1.name || ' ' || coalesce(p1.last, '') as player_1,
  p2.name || ' ' || coalesce(p2.last, '') as player_2,
  m.winner,
  m.score,
  m.status,
  m.date,
  m.created_at,
  ((m.p1 = 'charlie' and m.p2 = '96zp33j8' and m.winner = 'p1')
    or (m.p2 = 'charlie' and m.p1 = '96zp33j8' and m.winner = 'p2')) as charlie_beat_sam,
  (select string_agg(f.id, ', ') from public.fixtures f where f.match_id = m.id) as linked_fixture
from public.matches m
join public.leagues l on l.id = m.league_id
left join public.players p1 on p1.id = m.p1
left join public.players p2 on p2.id = m.p2
where l.name ilike 'seacourt%'
  and m.created_at >= '2026-10-22'
order by m.created_at;
