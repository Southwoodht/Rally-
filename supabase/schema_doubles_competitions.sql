-- Rally — doubles competitions (Part B)
--
-- NOT RUN BY A CODING SESSION. Sam runs this, then fix_function_grants.sql
-- (this file creates no function, so the sweep is a formality, but the habit
-- is the point).
--
-- ADDITIVE. Two new tables, four new nullable columns on doubles_fixtures, one
-- partial unique index, and policies for the new tables only. No existing row
-- is touched and no existing policy changes.
--
-- Sam, 26 Sep 2026: "custom yourself, I guess it's different per club." So a
-- competition is a container with a format, not a rulebook:
--
--   * format 'league'   — every pair plays every other pair `legs` times; a
--                          table on points, then set difference, then games.
--   * format 'knockout' — a seeded draw with byes; the next round is drawn
--                          from the results, nothing stored about the bracket
--                          beyond the fixtures themselves.
--
-- Points for a win and a draw are columns rather than constants because
-- that is exactly the kind of thing clubs disagree about.
--
-- ============================================================================
-- WHY FIXED PAIRS ARE A TABLE, AND WHY THAT IS NOT A "COMPOSITE PLAYER"
--
-- docs/doubles-readiness.md says never to fake a composite team player id.
-- A pair here is not a player: it has no rating and never appears on a table
-- of players. It is an ENTRY in one competition — "Sam & George entered the
-- Winter Doubles" — and the ratings keep reading the two real people off the
-- match, as they do for every other doubles result.
-- ============================================================================

create table if not exists public.doubles_competitions (
  id           uuid primary key default gen_random_uuid(),
  league_id    uuid not null references public.leagues(id) on delete cascade,
  name         text not null,
  format       text not null,
  legs         int  not null default 1,
  points_win   int  not null default 3,
  points_draw  int  not null default 1,
  status       text not null default 'running',
  created_by   text,
  created_at   timestamptz not null default now(),

  constraint doubles_competitions_format check (format in ('league', 'knockout')),
  constraint doubles_competitions_legs   check (legs between 1 and 4),
  constraint doubles_competitions_status check (status in ('running', 'finished')),
  constraint doubles_competitions_name   check (length(trim(name)) > 0)
);

create index if not exists doubles_competitions_league_idx
  on public.doubles_competitions (league_id);

-- text, not uuid: players.id is the app's own short id (§6, the trophies trap).
create table if not exists public.doubles_competition_pairs (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.doubles_competitions(id) on delete cascade,
  p1             text not null references public.players(id) on delete cascade,
  p2             text not null references public.players(id) on delete cascade,
  -- Knockout seeding: 1 is top. Order of entry for a league, where it only
  -- decides who is "home" in the fixture list.
  seed           int  not null,
  created_at     timestamptz not null default now(),

  constraint doubles_competition_pairs_distinct check (p1 <> p2)
);

create index if not exists doubles_competition_pairs_comp_idx
  on public.doubles_competition_pairs (competition_id);

-- ---------------------------------------------------------------------------
-- Competition fixtures are ordinary doubles fixtures with four more facts.
-- ---------------------------------------------------------------------------
-- A competition match is booked, rescheduled, cancelled and completed exactly
-- like any other doubles booking, so it lives in the same table and every
-- screen that lists doubles fixtures shows it without learning anything new.
-- Deleting a competition takes its unplayed fixtures with it (cascade);
-- results already played live in doubles_matches and are kept.

alter table public.doubles_fixtures
  add column if not exists competition_id uuid references public.doubles_competitions(id) on delete cascade;
alter table public.doubles_fixtures add column if not exists round int;
alter table public.doubles_fixtures
  add column if not exists pair_a uuid references public.doubles_competition_pairs(id) on delete cascade;
alter table public.doubles_fixtures
  add column if not exists pair_b uuid references public.doubles_competition_pairs(id) on delete cascade;

-- Two people pressing "Draw next round" at once must not create the tie twice.
create unique index if not exists doubles_fixtures_competition_tie_idx
  on public.doubles_fixtures (competition_id, round, pair_a, pair_b)
  where competition_id is not null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Read: anybody in the league. Write: league staff only — setting up a
-- competition is running the club, not playing in it. Playing in it needs
-- nothing new: the fixtures and results policies already cover that.

alter table public.doubles_competitions enable row level security;
alter table public.doubles_competition_pairs enable row level security;

drop policy if exists "read doubles competitions in your leagues" on public.doubles_competitions;
create policy "read doubles competitions in your leagues"
  on public.doubles_competitions for select
  using (public.is_league_member(league_id));

drop policy if exists "staff run doubles competitions" on public.doubles_competitions;
create policy "staff run doubles competitions"
  on public.doubles_competitions for all
  using (
    exists (select 1 from public.league_members lm
            where lm.league_id = doubles_competitions.league_id
              and lm.user_id = auth.uid() and lm.role in ('owner', 'editor'))
  )
  with check (
    exists (select 1 from public.league_members lm
            where lm.league_id = doubles_competitions.league_id
              and lm.user_id = auth.uid() and lm.role in ('owner', 'editor'))
  );

drop policy if exists "read competition pairs in your leagues" on public.doubles_competition_pairs;
create policy "read competition pairs in your leagues"
  on public.doubles_competition_pairs for select
  using (
    exists (select 1 from public.doubles_competitions c
            where c.id = doubles_competition_pairs.competition_id
              and public.is_league_member(c.league_id))
  );

drop policy if exists "staff enter competition pairs" on public.doubles_competition_pairs;
create policy "staff enter competition pairs"
  on public.doubles_competition_pairs for all
  using (
    exists (select 1 from public.doubles_competitions c
            join public.league_members lm on lm.league_id = c.league_id
            where c.id = doubles_competition_pairs.competition_id
              and lm.user_id = auth.uid() and lm.role in ('owner', 'editor'))
  )
  with check (
    exists (select 1 from public.doubles_competitions c
            join public.league_members lm on lm.league_id = c.league_id
            where c.id = doubles_competition_pairs.competition_id
              and lm.user_id = auth.uid() and lm.role in ('owner', 'editor'))
  );

-- ---------------------------------------------------------------------------
-- Verification — one statement, proving what THIS file did
-- ---------------------------------------------------------------------------
select
  (select count(*) from information_schema.tables
    where table_schema = 'public'
      and table_name in ('doubles_competitions', 'doubles_competition_pairs'))           as new_tables,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'doubles_fixtures'
      and column_name in ('competition_id', 'round', 'pair_a', 'pair_b'))                as fixture_columns,
  (select count(*) from pg_policies
    where schemaname = 'public'
      and tablename in ('doubles_competitions', 'doubles_competition_pairs'))            as policies,
  (select count(*) from pg_indexes
    where schemaname = 'public' and indexname = 'doubles_fixtures_competition_tie_idx')  as tie_index;

-- Expect: 2, 4, 4, 1.
