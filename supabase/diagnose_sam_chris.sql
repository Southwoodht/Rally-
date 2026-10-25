-- Southwood — before marking Sam v Chris Buckley as legacy (2026-10-25)
-- Read only. One query. Every match between the two, oldest first, plus how
-- many matches Chris has in total (if these are all of them, he will have
-- no rated matches left afterwards).
select m.id,
       to_char(m.date at time zone 'Europe/London', 'YYYY-MM-DD') as played,
       case when (m.winner = 'p1' and m.p1 = s.id) or (m.winner = 'p2' and m.p2 = s.id) then 'Sam won'
            when m.winner = 'draw' then 'draw' else 'Chris won' end as result,
       m.score, m.status, l.name as club,
       (select count(*) from public.matches x where x.p1 = c.id or x.p2 = c.id) as chris_matches_in_total
  from public.matches m
  join public.players s on s.id in (m.p1, m.p2) and s.name ilike 'sam%' and s.last ilike 'henry'
  join public.players c on c.id in (m.p1, m.p2) and c.name ilike 'chris%' and c.last ilike 'buckley'
  join public.leagues l on l.id = m.league_id
 order by m.date;
