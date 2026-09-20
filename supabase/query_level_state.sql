-- Rally — what the database actually holds about levels
--
-- READ ONLY. Nothing is written, nothing is changed. Safe to run any time.
--
-- Paste the output back. It answers, in one go:
--
--   * whether Jamie's level is really gone, or just never had a timeline
--   * who has an account (and so whose row the app refuses to let you edit)
--   * who is missing the level history that grading a match needs
--   * whether anybody exists twice, which is the other explanation for a
--     level "resetting" — a second row that never had one
--
-- `level` is the dropdown: the claim about today. `level_history` is the
-- timeline: what they were on a given date. Only the timeline grades a match.
-- A player can have the first and not the second, and that is the single most
-- likely reason a win is scoring more than it should.

select
  l.name                                        as league,
  p.name || ' ' || coalesce(p.last, '')         as player,
  case when p.auth_id is null then 'shell — you can edit this'
       else 'has an account — only they can edit it' end as row_status,
  case when p.level is null then '—'
       else (p.level ->> 'cat') || ' / ' || (p.level ->> 'sub') end as level_today,
  case when jsonb_typeof(p.level_history) = 'array'
       then jsonb_array_length(p.level_history) else 0 end as timeline_entries,
  (select count(*) from public.matches m
     where (m.p1 = p.id or m.p2 = p.id) and m.status = 'confirmed')  as confirmed_matches,
  p.inactive,
  p.id
from public.players p
left join public.leagues l on l.id = p.league_id
order by l.name nulls last, lower(p.name), lower(coalesce(p.last, ''));

-- Anybody appearing twice under the same first name. NOT a merge list — two
-- people really can share a name, and merging on a name match is what caused
-- the Charlie incident. This is only so you can see whether a level went
-- missing because it is sitting on a second row.
select lower(p.name) as first_name, count(*) as rows,
       string_agg(coalesce(p.last, '(no surname)') || ' [' ||
                  case when p.auth_id is null then 'shell' else 'account' end || ']', ', ') as which
from public.players p
group by lower(p.name)
having count(*) > 1
order by 2 desc, 1;
