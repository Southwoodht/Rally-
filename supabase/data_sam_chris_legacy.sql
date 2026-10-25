-- Southwood — DATA CHANGE: Sam v Chris Buckley 2017–2020 become legacy (2026-10-25)
--
-- Run schema_match_legacy.sql FIRST (it adds date_precision).
-- Run diagnose_sam_chris.sql first too and check the list.
--
-- What it does: the matches between Sam Henry and Chris Buckley dated
-- 2017–2020 get status 'legacy' and date_precision 'year'. Nothing is
-- deleted and the dates are kept. From then on they show in history and
-- head-to-head ("+4 legacy") and count in no rating.
--
-- Guarded: it expects exactly FOUR such matches (one a year, as described).
-- If it finds any other number it stops with an error and changes nothing.
-- Undo, if ever wanted: set status back to 'confirmed', date_precision 'day'
-- for the same ids.

do $$
declare n int;
begin
  select count(*) into n
    from public.matches m
    join public.players s on s.id in (m.p1, m.p2) and s.name ilike 'sam%' and s.last ilike 'henry'
    join public.players c on c.id in (m.p1, m.p2) and c.name ilike 'chris%' and c.last ilike 'buckley'
   where m.date >= '2017-01-01' and m.date < '2021-01-01'
     and m.status = 'confirmed';
  if n <> 4 then
    raise exception 'Expected 4 Sam v Chris matches in 2017–2020, found %. Nothing changed.', n;
  end if;
  update public.matches m
     set status = 'legacy', date_precision = 'year'
    from public.players s, public.players c
   where s.id in (m.p1, m.p2) and s.name ilike 'sam%' and s.last ilike 'henry'
     and c.id in (m.p1, m.p2) and c.name ilike 'chris%' and c.last ilike 'buckley'
     and m.date >= '2017-01-01' and m.date < '2021-01-01'
     and m.status = 'confirmed';
end $$;

-- Proves it. Expect: 4, 0.
select
  count(*) filter (where m.status = 'legacy' and m.date_precision = 'year') as now_legacy,
  count(*) filter (where m.status = 'confirmed') as still_rated_2017_2020
  from public.matches m
  join public.players s on s.id in (m.p1, m.p2) and s.name ilike 'sam%' and s.last ilike 'henry'
  join public.players c on c.id in (m.p1, m.p2) and c.name ilike 'chris%' and c.last ilike 'buckley'
 where m.date >= '2017-01-01' and m.date < '2021-01-01';
