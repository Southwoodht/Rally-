-- Southwood — who the 5-match cut-off moves under "Not ranked yet" (brief item 4).
--
-- Reads only. One statement. Every Seacourt player with their singles
-- matches all time and in 2026, counted the way the table counts them (a
-- logged result counts whether or not it has been agreed; bookings, cancelled
-- and declined ones do not), and whether each view would rank them.

select trim(p.name) || coalesce(' ' || trim(p.last), '')                as player,
       count(m.id)                                                      as matches_all_time,
       count(m.id) filter (where m.date >= '2026-01-01')                as matches_2026,
       case when count(m.id) >= 5 then 'ranked' else 'below: ' || (5 - count(m.id)) || ' to go' end
                                                                        as all_time_table,
       case when count(m.id) filter (where m.date >= '2026-01-01') >= 5 then 'ranked'
            else 'below: ' || (5 - count(m.id) filter (where m.date >= '2026-01-01')) || ' to go' end
                                                                        as table_2026
  from public.players p
  join public.leagues l on l.id = p.league_id and l.name ilike 'Seacourt%'
  left join public.matches m
         on (m.p1 = p.id or m.p2 = p.id)
        and coalesce(m.status, 'confirmed') not in ('proposed', 'scheduled', 'awaiting', 'cancelled', 'declined')
 group by p.id, p.name, p.last
 order by count(m.id) desc, 1;
