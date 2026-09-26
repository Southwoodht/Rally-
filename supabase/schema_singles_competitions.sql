-- Rally — singles competitions, on the doubles competitions' tables
--
-- NOT RUN BY A CODING SESSION. Sam runs this. It creates no function, so no
-- grants sweep is needed.
--
-- ADDITIVE / LOOSENING ONLY. No existing row is rewritten:
--   * doubles_competitions gains `kind` ('doubles' by default, so every
--     existing competition stays exactly what it was);
--   * doubles_competition_pairs.p2 becomes nullable — a singles ENTRY is one
--     player. The table keeps its name rather than being renamed under the
--     live app; think of it as "competition entries";
--   * fixtures (singles) gains competition_id and round, both nullable, so
--     every existing booking is untouched.
--
-- WHY ONE SYSTEM, NOT TWO. Sam, 26 Sep: the admin should be simple "yet with
-- the same impressive ideas". A second, singles-only competitions table
-- would be a second set of rules to learn and a second place for them to
-- drift apart. The schedule, the draw, the bracket and the table are already
-- written and tested once (core/doubles/competition.ts); singles uses them.
--
-- A singles competition tie is an ordinary singles fixture with two more
-- facts. It is booked, played and entered exactly like any other — including
-- the rule that a result against somebody with an account waits for them to
-- agree — and it counts on the singles table because it is a real match.

alter table public.doubles_competitions
  add column if not exists kind text not null default 'doubles';

alter table public.doubles_competitions drop constraint if exists doubles_competitions_kind;
alter table public.doubles_competitions add constraint doubles_competitions_kind
  check (kind in ('doubles', 'singles'));

-- A comparison with null is null, which a CHECK treats as passing, so the
-- existing "p1 <> p2" rule needs no change for a one-player entry.
alter table public.doubles_competition_pairs alter column p2 drop not null;

alter table public.fixtures
  add column if not exists competition_id uuid references public.doubles_competitions(id) on delete cascade;
alter table public.fixtures add column if not exists round int;

-- Two people pressing "Draw the next match" at once must not create the tie twice.
create unique index if not exists fixtures_competition_tie_idx
  on public.fixtures (competition_id, round, p1, p2)
  where competition_id is not null;

-- ---------------------------------------------------------------------------
-- Verification — one statement, proving what THIS file did
-- ---------------------------------------------------------------------------
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'doubles_competitions' and column_name = 'kind')        as kind_column,
  (select is_nullable from information_schema.columns
    where table_schema = 'public' and table_name = 'doubles_competition_pairs' and column_name = 'p2')     as entry_p2_nullable,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'fixtures' and column_name in ('competition_id', 'round')) as fixture_columns,
  (select count(*) from pg_indexes
    where schemaname = 'public' and indexname = 'fixtures_competition_tie_idx')                            as tie_index;

-- Expect: 1, YES, 2, 1.
