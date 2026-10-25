-- Southwood — legacy results (2026-10-25)
--
-- Additive: one column, no existing row changed. Safe to re-run.
--
-- Sam: record old results that were never logged at the time ("one summary
-- win per year"), shown in history and head-to-head, never in a rating.
--
-- A legacy result is a match with status 'legacy'. That needs no migration —
-- matches.status has no check constraint, and the app (core/matchStatus.ts)
-- counts it in nothing. The Global table's SQL already counts only
-- 'confirmed', so it cannot leak in there either.
--
-- What does need the database: how precisely the date is known. An old
-- result is often known only to the year, and the app must print "2018",
-- never an invented 1 July. Existing rows default to 'day', which is what
-- they all are.

alter table public.matches add column if not exists date_precision text not null default 'day';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'matches_date_precision_check') then
    alter table public.matches add constraint matches_date_precision_check check (date_precision in ('day', 'year'));
  end if;
end $$;

notify pgrst, 'reload schema';

-- Proves what this file did. Expect: date_precision, text, 'day'::text, 1.
select column_name, data_type, column_default,
       (select count(*) from pg_constraint where conname = 'matches_date_precision_check') as check_constraint
  from information_schema.columns
 where table_schema = 'public' and table_name = 'matches' and column_name = 'date_precision';
