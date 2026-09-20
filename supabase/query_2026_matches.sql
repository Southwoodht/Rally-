-- Rally — every confirmed 2026 match, one row each. ONE query.
--
-- READ ONLY.
--
-- WHY THIS AND NOT A SUMMARY
--
-- The question is why Sam has roughly double Charlie's Official points when
-- they are 5-4 head to head. Official is
--
--     (mean of your five best win qualities) x win-rate² x activity x 100
--
-- and every one of those terms needs the match list: the five best wins need
-- to know who each win was against and what they were rated at the time, the
-- win rate needs the whole record, and activity needs the count. A summary of
-- wins and losses cannot reconstruct it, which is why the last two attempts at
-- this were reasoning rather than measuring.
--
-- With these rows the whole thing becomes arithmetic. Same reason §9 asks for
-- the match extract before touching any ranking.
--
-- The level columns are each player's level AT THE TIME, resolved from their
-- timeline the same way levelAt() does — not their level today, which is a
-- different number and the one that would quietly give the wrong answer.

select
  to_char(m.date, 'YYYY-MM-DD')                                  as played,
  wp.name || ' ' || coalesce(wp.last, '')                        as winner,
  coalesce(
    (select e ->> 'cat' || '/' || (e ->> 'sub')
       from jsonb_array_elements(wp.level_history) e
      where to_char(m.date, 'YYYY-MM') >= lpad(e ->> 'from', 7, '0')
        and (e ->> 'to' is null or to_char(m.date, 'YYYY-MM') <= (e ->> 'to'))
      limit 1), '—')                                             as winner_level_then,
  lp.name || ' ' || coalesce(lp.last, '')                        as loser,
  coalesce(
    (select e ->> 'cat' || '/' || (e ->> 'sub')
       from jsonb_array_elements(lp.level_history) e
      where to_char(m.date, 'YYYY-MM') >= lpad(e ->> 'from', 7, '0')
        and (e ->> 'to' is null or to_char(m.date, 'YYYY-MM') <= (e ->> 'to'))
      limit 1), '—')                                             as loser_level_then,
  coalesce(m.score, '')                                          as score,
  m.winner                                                       as raw_winner
from public.matches m
join public.players wp on wp.id = case when m.winner = 'p1' then m.p1 else m.p2 end
join public.players lp on lp.id = case when m.winner = 'p1' then m.p2 else m.p1 end
where m.status = 'confirmed'
  and m.date >= '2026-01-01'
order by m.date;
