-- ============================================================================
-- Each division (competition) can have its own dates — Sam, 2026-10-23:
-- "beginning of the year I had advantage, so I want this one started a
-- month ago — each division gets its own timeline, editable afterwards."
--
-- Two nullable columns. Null means "the season's dates", which is what every
-- existing competition keeps, so nothing changes for anything already there.
-- No data touched, no policy changed: "staff run doubles competitions" (for
-- all, owner/editor) already lets organisers update these rows.
-- ============================================================================

alter table public.doubles_competitions add column if not exists starts_on date;
alter table public.doubles_competitions add column if not exists ends_on date;

-- Proves the columns, not the policies: expect 2.
select count(*) as division_date_columns
from information_schema.columns
where table_schema = 'public' and table_name = 'doubles_competitions'
  and column_name in ('starts_on', 'ends_on');
