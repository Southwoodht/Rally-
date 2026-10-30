-- Southwood — every George Henry v Will Allen result (2026-10-30)
-- Read only. One query. Oldest played first. "entered" is when the row was
-- saved, which is not the order ratings use — they go by "played".
select m.id,
       to_char(m.date at time zone 'Europe/London', 'YYYY-MM-DD') as played,
       to_char(m.created_at at time zone 'Europe/London', 'YYYY-MM-DD HH24:MI') as entered,
       coalesce(nullif(m.score, ''), '—') as score,
       case when m.winner = 'draw' then 'draw'
            when (m.winner = 'p1' and m.p1 = g.id) or (m.winner = 'p2' and m.p2 = g.id) then 'George'
            else 'Will' end as winner,
       m.status
  from public.matches m
  join public.players g on g.id in (m.p1, m.p2) and g.name ilike 'george%' and g.last ilike 'henry'
  join public.players w on w.id in (m.p1, m.p2) and w.name ilike 'will%' and w.last ilike 'allen'
 order by m.date, m.created_at;
