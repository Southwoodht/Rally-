-- Rally — undo schema_doubles.sql
--
-- NOT RUN BY A CODING SESSION, and not run at all unless something is wrong.
--
-- THIS IS THE UNDO BUTTON, written at the same time as the migration rather
-- than after something broke. It exists because Sam wanted a backup and was
-- away from the laptop: a data backup protects against losing rows, and this
-- protects against the change itself. They are not the same thing, and this
-- is the half I can actually provide.
--
-- ============================================================================
-- READ THIS BEFORE RUNNING IT
--
-- `drop table public.doubles_matches` DELETES EVERY DOUBLES RESULT ANYONE HAS
-- LOGGED. If doubles has been live for any length of time, that is real data
-- and it is not coming back. This file is for "the migration just went in and
-- something is wrong", not for housekeeping.
--
-- Section 3 of CLAUDE.md: destructive things take two steps and the confirm
-- states the number out loud. So step 0 below counts the rows and stops. Run
-- it on its own, read the number, and only then decide.
--
-- NOTHING HERE TOUCHES SINGLES. It drops only objects schema_doubles.sql
-- created: one table, one trigger, one function, two columns on leagues. No
-- existing table, row or policy is referenced.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- STEP 0 — run this alone, first
-- ---------------------------------------------------------------------------
-- One statement, because the Supabase editor shows the last result only.

select count(*) as doubles_results_that_would_be_deleted
  from public.doubles_matches;

-- If that number is 0, nothing is lost and the rest is safe.
-- If it is not 0, those results disappear. Export the table first:
--   Table Editor -> doubles_matches -> the ... menu -> Download as CSV.

-- ---------------------------------------------------------------------------
-- STEP 1 — the undo itself
-- ---------------------------------------------------------------------------
-- Everything below is a separate paste, after step 0 has been read.
--
-- Order matters: the trigger goes before the function it calls, and the table
-- goes before nothing — dropping the table takes its policies and indexes
-- with it, which is why they are not listed individually.

-- drop trigger if exists doubles_match_is_sane_trg on public.doubles_matches;
-- drop function if exists public.doubles_match_is_sane();
-- drop table if exists public.doubles_matches;

-- The flags last, and think about whether you want them gone at all.
-- Leaving them is harmless — they are two false booleans — and keeping them
-- means turning doubles back on later needs no migration. Drop them only if
-- you want the schema exactly as it was.

-- alter table public.leagues drop column if exists doubles_enabled;
-- alter table public.leagues drop column if exists competitions_enabled;

-- ---------------------------------------------------------------------------
-- COMMENTED OUT ON PURPOSE
-- ---------------------------------------------------------------------------
-- Every destructive line above is a comment. Uncommenting is the second of
-- the two steps, and it is a deliberate act rather than a paste that runs the
-- moment it lands in the editor. A rollback file that executes on arrival is
-- how you lose the thing you were trying to protect.
--
-- The code side has its own undo and needs none of this: the tag
-- `rally-pre-doubles-2026-09-25` is master exactly as deployed before any of
-- this work, so `git reset --hard rally-pre-doubles-2026-09-25` on master puts
-- the app back. The app degrades on its own anyway — every doubles read is
-- wrapped, so with the table gone the screens show "no doubles yet" rather
-- than an error.
