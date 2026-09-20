-- Rally — who has a level timeline, and from when. ONE query.
--
-- READ ONLY.
--
-- One statement on purpose. The Supabase SQL editor displays only the result
-- of the LAST statement in a script, so a file with two queries silently
-- shows you the second and hides the first. That has now cost two round trips
-- on two different questions — the grants check and this one — with the same
-- symptom each time: the answer pasted back was real, and was not the answer
-- to the question asked.
--
-- WHAT THE COLUMNS MEAN
--
--   level_today      the dropdown. A claim about now. Does NOT grade matches.
--   timeline_entries the level history. This is the one that grades a match,
--                    because computeOfficial and elo.ts both ask
--                    levelAt(opponent, match_date) — what they were ON THE DAY.
--   timeline_from    the start of the earliest period. **Every match before
--                    this date grades flat**, however complete the timeline
--                    looks. A level recorded "from 2026" does not grade a
--                    match played in 2019.
--   graded_window    confirmed matches played on or after timeline_from —
--                    the ones that can actually be graded against them.
--   confirmed        all their confirmed matches.
--
-- The gap between the last two is the answer to "why is a win worth flat".

select
  coalesce(l.name, '(no league)')                          as league,
  p.name || ' ' || coalesce(p.last, '')                    as player,
  case when p.auth_id is null then 'shell' else 'account' end as row_type,
  case when p.level is null then '—'
       else (p.level ->> 'cat') || ' / ' || (p.level ->> 'sub') end as level_today,
  case when jsonb_typeof(p.level_history) = 'array'
       then jsonb_array_length(p.level_history) else 0 end as timeline_entries,
  -- An admin estimate lives in its OWN columns and the line above cannot see
  -- it. The first version of this query read only level_history, so a level
  -- filled in for somebody with an account came back as 0 entries and looked
  -- like it had never saved. It had.
  case when jsonb_typeof(p.level_estimate_history) = 'array'
       then jsonb_array_length(p.level_estimate_history) else 0 end as est_entries,
  (p.level_estimate ->> 'cat')                             as est_level,
  (p.level_history -> 0 ->> 'from')                        as timeline_from,
  (select count(*) from public.matches m
    where (m.p1 = p.id or m.p2 = p.id)
      and m.status = 'confirmed'
      and jsonb_typeof(p.level_history) = 'array'
      and jsonb_array_length(p.level_history) > 0
      and to_char(m.date, 'YYYY-MM') >= lpad(p.level_history -> 0 ->> 'from', 7, '0'))
                                                           as graded_window,
  (select count(*) from public.matches m
    where (m.p1 = p.id or m.p2 = p.id) and m.status = 'confirmed') as confirmed,
  p.inactive
from public.players p
left join public.leagues l on l.id = p.league_id
order by l.name nulls last, lower(p.name), lower(coalesce(p.last, ''));
