-- Results that may have been FORCED to a winner by the old score check
-- (Sam, 2026-11-15). Until today a score with the sets level (3-6, 6-4)
-- was decided on total games, so it could not be saved as a draw and the
-- app pushed whoever had more games into the winner's seat.
--
-- Lists every singles result that has a winner and either:
--   * one set each (or 2-2...) on the score as written, or
--   * a score the app can't read at all (Will Allen v George Henry, 20 Mar,
--     was typed as "6-0 George - 6-3 Will": one set each, written in words).
-- Short matches are left out: total games still decide those.
--
-- Some of these will be genuine wins on a tie-break nobody wrote down. Only
-- the players know which. READ ONLY: nothing is changed. Correct any that
-- should be draws from match detail (organiser Edit).
with parts as (
  select m.id,
         regexp_match(trim(x.part), '^(\d{1,3})\s*[-–—]\s*(\d{1,3})$') as g
  from public.matches m
  cross join lateral unnest(string_to_array(m.score, ',')) as x(part)
  where coalesce(trim(m.score), '') <> ''
),
agg as (
  select id,
         count(*) as sets,
         bool_and(g is not null) as readable,
         count(*) filter (where g is not null and g[1]::int > g[2]::int) as sets_p1,
         count(*) filter (where g is not null and g[2]::int > g[1]::int) as sets_p2
  from parts
  group by id
)
select l.name as club,
       to_char(m.date at time zone 'Europe/London', 'DD Mon YYYY') as played,
       trim(p1.name || ' ' || coalesce(p1.last, '')) as player_1,
       trim(p2.name || ' ' || coalesce(p2.last, '')) as player_2,
       m.score,
       case m.winner when 'p1' then trim(p1.name || ' ' || coalesce(p1.last, ''))
                     else trim(p2.name || ' ' || coalesce(p2.last, '')) end as saved_winner,
       m.status,
       case when not a.readable then 'score can''t be read'
            else a.sets_p1 || ' set' || case when a.sets_p1 = 1 then '' else 's' end || ' each' end as why,
       m.id
from public.matches m
join agg a on a.id = m.id
join public.players p1 on p1.id = m.p1
join public.players p2 on p2.id = m.p2
left join public.leagues l on l.id = m.league_id
where m.winner <> 'draw'
  and m.status in ('confirmed', 'pending', 'disputed')
  and (not a.readable or (a.sets >= 2 and a.sets_p1 = a.sets_p2))
order by m.date;
