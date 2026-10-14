-- Southwood — is a trophy a singles or a doubles honour
--
-- One nullable column, plus a tag on existing trophies whose name says
-- doubles. Changes no policy. Safe to re-run.
--
-- Sam, 2026-10-14, after Zaach's trophy turned out to be a doubles one: a
-- trophy is a badge of honour, not a rating input — the matches that won it
-- move the ratings when they are logged, and counting the trophy too would
-- count them twice. What the tag does is put the honour on the right side of
-- the app: the doubles feed, the doubles profile and doubles history for a
-- doubles trophy; the singles side for everything else.
--
-- Null means "not said", and is shown on the singles side, which is where
-- every trophy showed before this column existed.

alter table public.trophies add column if not exists format text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'trophies_format' and conrelid = 'public.trophies'::regclass
  ) then
    alter table public.trophies
      add constraint trophies_format check (format is null or format in ('singles', 'doubles'));
  end if;
end $$;

-- THE ONE DATA CHANGE, flagged: existing trophies with "doubles" in the
-- competition name are tagged doubles (Zaach's "Helen's Cup Fun Doubles").
-- Only rows not yet tagged, so a re-run never overrides a choice made in the
-- app. Nothing else on those rows is touched.
update public.trophies
   set format = 'doubles'
 where format is null
   and kind = 'trophy'
   and competition ilike '%doubles%';

notify pgrst, 'reload schema';

-- Proves the column and the tag. Expect: format, YES, and the number of
-- trophies now tagged doubles (1 if Zaach's is the only one).
select c.column_name, c.is_nullable,
       (select count(*) from public.trophies where format = 'doubles') as doubles_trophies
  from information_schema.columns c
 where c.table_schema = 'public' and c.table_name = 'trophies' and c.column_name = 'format';
