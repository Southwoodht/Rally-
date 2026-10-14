-- Southwood — the date a trophy was won
--
-- Additive migration. One nullable column. Touches no rows, changes no policy.
-- Safe to re-run.
--
-- Sam, 2026-10-14: a trophy should "come up in match history ... then someone
-- could see they were having a great year and ended it with a title". The
-- `season` column is free text ("2019", "Summer 2026") and says which year,
-- not which day, so a trophy could be put beside a year but not in the run of
-- matches that led to it. This is that day.
--
-- Nullable on purpose and never back-filled: most of a club's honours are old
-- and nobody remembers the date. An undated trophy still shows under its year
-- and on the profile; it just isn't placed in the timeline, because placing it
-- on 31 December would be inventing a date — and would sit it after matches it
-- may well have come before.
--
-- The existing read/insert/update policies cover the new column as they cover
-- every other one; nothing is widened.

alter table public.trophies add column if not exists won_on date;

-- The API caches the table's columns; until it reloads, it rejects won_on as
-- unknown even though the column is there. This makes it reload now.
notify pgrst, 'reload schema';

-- Proves the column itself, not the policies around it. Expect: won_on, date, YES.
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public' and table_name = 'trophies' and column_name = 'won_on';
