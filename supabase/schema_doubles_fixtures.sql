-- Rally — booking a doubles match (Part A, A5)
--
-- NOT RUN BY A CODING SESSION. Sam runs this.
--
-- ADDITIVE. One new table and its policies. Nothing existing is touched: no
-- column added to fixtures, no policy on it changed, no row rewritten.
--
-- ============================================================================
-- WHY A SECOND FIXTURES TABLE RATHER THAN p3/p4 ON THE FIRST
--
-- public.fixtures is (p1, p2) and every one of its readers assumes exactly
-- that — FixturesPanel, the Coming up block on the feed, resolveFixture, the
-- round-robin generator. Two nullable columns would be invisible to all of
-- them, so a doubles booking would render as a singles one between the first
-- two players and could be completed as a singles result. That is the same
-- reasoning that kept doubles_matches separate from matches, and it is the
-- reason the brief's instruction not to generalise p1/p2 is right.
--
-- The cost is honest and worth naming: "my fixtures" is now two queries, and
-- anything listing upcoming matches has to read both tables and merge. The
-- alternative is a column that half the app misreads.
--
-- NOTE ON doubles_matches.fixture_id: it references public.fixtures(id),
-- which is the SINGLES fixtures table, and that is now the wrong target for a
-- doubles booking. It is left alone rather than repointed — it is nullable,
-- nothing writes it yet, and changing a foreign key is not additive. The new
-- column below is the one doubles uses.
-- ============================================================================

create table if not exists public.doubles_fixtures (
  id           uuid primary key default gen_random_uuid(),
  league_id    uuid not null references public.leagues(id) on delete cascade,

  -- text, not uuid: players.id is the app's own short id. Same trap as
  -- trophies.player_id, recorded in section 6.
  team_a_p1    text not null references public.players(id) on delete cascade,
  team_a_p2    text not null references public.players(id) on delete cascade,
  team_b_p1    text not null references public.players(id) on delete cascade,
  team_b_p2    text not null references public.players(id) on delete cascade,

  -- When it is booked for. Null means agreed but not yet scheduled, exactly
  -- as fixtures.booked works today.
  booked       timestamptz,
  done         boolean not null default false,

  -- The result, once played. uuid because doubles_matches.id is a uuid.
  match_id     uuid references public.doubles_matches(id) on delete set null,

  created_by   text,
  created_at   timestamptz not null default now(),

  constraint doubles_fixtures_distinct_players check (
    team_a_p1 <> team_a_p2 and
    team_a_p1 <> team_b_p1 and
    team_a_p1 <> team_b_p2 and
    team_a_p2 <> team_b_p1 and
    team_a_p2 <> team_b_p2 and
    team_b_p1 <> team_b_p2
  )
);

create index if not exists doubles_fixtures_league_idx
  on public.doubles_fixtures (league_id, booked);

-- ---------------------------------------------------------------------------
-- The four must be in this league
-- ---------------------------------------------------------------------------
-- A CHECK cannot query another table, so this is a trigger, and it raises
-- rather than correcting. Same shape as doubles_match_is_sane.

create or replace function public.doubles_fixture_is_sane()
returns trigger
language plpgsql
as $$
declare
  wrong_league int;
begin
  select count(*) into wrong_league
  from public.players p
  where p.id in (new.team_a_p1, new.team_a_p2, new.team_b_p1, new.team_b_p2)
    and p.league_id is distinct from new.league_id;

  if wrong_league > 0 then
    raise exception 'All four players must belong to league %', new.league_id;
  end if;

  return new;
end
$$;

revoke all on function public.doubles_fixture_is_sane() from public, anon;

drop trigger if exists doubles_fixture_is_sane_trg on public.doubles_fixtures;
create trigger doubles_fixture_is_sane_trg
  before insert or update on public.doubles_fixtures
  for each row execute function public.doubles_fixture_is_sane();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Booking is looser than logging a result on purpose, and it matches what
-- singles fixtures already allow: any league member may create a fixture,
-- because arranging a match for other people is a normal thing for whoever
-- organises the club to do. Recording a RESULT is the part that needs you to
-- have been on court, and that rule lives on doubles_matches.
--
-- DELETE is open to participants as well as staff, which is deliberate and
-- mirrors schema_fixture_delete_participants.sql: cancelling a match you are
-- in should not need an owner.

alter table public.doubles_fixtures enable row level security;

drop policy if exists "read doubles fixtures in your leagues" on public.doubles_fixtures;
create policy "read doubles fixtures in your leagues"
  on public.doubles_fixtures for select
  using (public.is_league_member(league_id));

drop policy if exists "book a doubles match in your league" on public.doubles_fixtures;
create policy "book a doubles match in your league"
  on public.doubles_fixtures for insert
  with check (public.is_league_member(league_id));

drop policy if exists "update doubles fixtures in your league" on public.doubles_fixtures;
create policy "update doubles fixtures in your league"
  on public.doubles_fixtures for update
  using (public.is_league_member(league_id))
  with check (public.is_league_member(league_id));

drop policy if exists "participants and staff can cancel doubles fixtures" on public.doubles_fixtures;
create policy "participants and staff can cancel doubles fixtures"
  on public.doubles_fixtures for delete
  using (
    exists (
      select 1 from public.players pl
      where pl.id in (doubles_fixtures.team_a_p1, doubles_fixtures.team_a_p2,
                      doubles_fixtures.team_b_p1, doubles_fixtures.team_b_p2)
        and pl.auth_id = auth.uid()
    )
    or exists (
      select 1 from public.league_members lm
      where lm.league_id = doubles_fixtures.league_id
        and lm.user_id = auth.uid() and lm.role in ('owner', 'editor')
    )
  );

-- ---------------------------------------------------------------------------
-- Verification — one statement, proving what THIS file did
-- ---------------------------------------------------------------------------

select
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'doubles_fixtures')            as table_exists,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'doubles_fixtures')            as columns,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'doubles_fixtures')               as policies,
  (select count(*) from pg_trigger
    where tgrelid = 'public.doubles_fixtures'::regclass and not tgisinternal)     as triggers;

-- Expect: 1 table, 11 columns, 4 policies, 1 trigger.
-- Counted from the column list above rather than guessed — the last file's
-- closing comment said 19 where the answer was 18, which reports a correct
-- migration as a failure.
--
-- THEN RUN supabase/fix_function_grants.sql. This file creates a function.
