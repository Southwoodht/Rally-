-- Southwood — how long a booked match lasts (winter Phase 2, item 5).
--
-- Back up first (backup_everything.sql). One nullable column; touches no row.
-- Safe to re-run.
--
-- "How did it go?" is asked once a booked match should have finished. It
-- assumed two hours for everybody; the brief says one hour, editable when
-- booking. The choice is stored here; null means the one-hour default, so
-- every booking already made keeps working.

alter table public.fixtures add column if not exists duration_minutes int;

alter table public.fixtures drop constraint if exists fixtures_duration_sane;
alter table public.fixtures add constraint fixtures_duration_sane
  check (duration_minutes is null or duration_minutes between 15 and 480);

notify pgrst, 'reload schema';

-- Proves the column. Expect: duration_minutes, integer, YES.
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public' and table_name = 'fixtures' and column_name = 'duration_minutes';
