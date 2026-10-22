-- Southwood — the two scores that don't match their result (brief-2, item 2).
-- Read-only. One statement. By match id, so nothing else is touched or shown.
--   xefu1o73  14 Sep 2026, Charlie Henry v Zaach Rodriguez, saved as a loss "6-6"
--   me3n6foy  20 Mar 2026, Will Allen v George Henry, saved as a draw "6-0 George - 6-3 Will"

select m.id, m.date, p1.name || ' ' || coalesce(p1.last, '') as player_1,
       p2.name || ' ' || coalesce(p2.last, '') as player_2,
       m.winner, m.score, m.status, m.created_at, m.updated_at
from public.matches m
left join public.players p1 on p1.id = m.p1
left join public.players p2 on p2.id = m.p2
where m.id in ('xefu1o73', 'me3n6foy')
order by m.date;
