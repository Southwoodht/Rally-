-- Rally — fixtures for matches that belong to no league
--
-- NOT RUN BY A CODING SESSION. Sam runs this.
--
-- WHY
--
-- Friendlies work everywhere except the one screen that arranges them.
-- schema_match_bookings.sql made matches.league_id nullable and
-- schema_friendly_players.sql did the same for players, so a league-less
-- result has two players and a home. A league-less *fixture* — a game the two
-- of them have agreed to play and not played yet — has nowhere to go:
-- fixtures.league_id is `not null`, so "Book a match" in Friendlies fails at
-- the database with a constraint violation. The Fixtures tab is in the bottom
-- nav for a friendly exactly as it is for a league, so this is reachable in
-- two taps.
--
-- Nothing is rewritten and no existing row changes. Every league fixture
-- keeps its league and behaves exactly as before; the policies widen rather
-- than replace, on the pattern schema_match_bookings.sql already set for
-- matches.
--
-- Posts deliberately do NOT get the same treatment. A league-less post has no
-- audience — there is no league to announce to — and the only sane reading of
-- "visible to any signed-in account" would be a single global feed shared by
-- every friendly player in the world. The app hides the composer in
-- Friendlies instead.

-- 1. A fixture can exist without a league --------------------------------
alter table public.fixtures alter column league_id drop not null;

-- 2. Reading -------------------------------------------------------------
--
-- The existing policy is is_league_member(league_id), which is not true for
-- null — so without this a friendly fixture is invisible to the two people
-- who arranged it. The league branch is exactly as it was.
--
-- Narrower than the equivalent for players: a league-less player row is
-- readable by anyone signed in, because it is a name and a match has to be
-- able to say who it was against. A fixture is an arrangement between two
-- people and is nobody else's business.
drop policy if exists "read fixtures in your leagues" on public.fixtures;

create policy "read fixtures in your leagues"
  on public.fixtures for select
  using (
    (league_id is not null and public.is_league_member(league_id))
    or exists (
      select 1 from public.players pl
      where pl.id in (fixtures.p1, fixtures.p2) and pl.auth_id = auth.uid()
    )
  );

-- 3. Creating ------------------------------------------------------------
--
-- Into a league: unchanged, you must be a member. Outside one: you must be
-- one of the two players. Deliberately not "anybody signed in" — booking two
-- other people a match is arranging somebody else's week.
drop policy if exists "manage fixtures in your league" on public.fixtures;

create policy "manage fixtures in your league"
  on public.fixtures for insert
  with check (
    (league_id is not null and public.is_league_member(league_id))
    or (
      league_id is null
      and exists (
        select 1 from public.players pl
        where pl.id in (fixtures.p1, fixtures.p2) and pl.auth_id = auth.uid()
      )
    )
  );

-- 4. Updating ------------------------------------------------------------
--
-- Booking a time, and marking one done when the result is entered. Same two
-- branches.
drop policy if exists "update fixtures in your league" on public.fixtures;

create policy "update fixtures in your league"
  on public.fixtures for update
  using (
    (league_id is not null and public.is_league_member(league_id))
    or exists (
      select 1 from public.players pl
      where pl.id in (fixtures.p1, fixtures.p2) and pl.auth_id = auth.uid()
    )
  );

-- 5. Deleting ------------------------------------------------------------
--
-- Nothing to do. schema_fixture_delete_participants.sql already resolves a
-- participant through players.auth_id without reading league_id, so it
-- covers a league-less fixture exactly as written.
