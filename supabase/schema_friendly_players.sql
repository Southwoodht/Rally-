-- Rally — players who belong to no league, so friendlies have two sides
--
-- NOT RUN BY A CODING SESSION. Sam runs this.
--
-- WHY
--
-- "Some people might have like two mates and don't care about leagues yet."
-- The matches side of that already works: schema_match_bookings.sql made
-- matches.league_id nullable and widened the read and insert policies so a
-- match with no league is visible to, and writable by, the two people in it.
--
-- What stops it being reachable is one row short of the pair. A match names
-- two players.id, and players.league_id is `not null` — so somebody in no
-- league has no player row, and neither does the mate they want to record a
-- game against. There is nothing to put on either side of the match.
--
-- This makes a league-less player row possible, and says who may touch one.
--
-- Nothing is rewritten and no existing row changes. Every league player row
-- keeps its league and behaves exactly as before; the policies below widen
-- what is allowed rather than replacing what was.

-- 1. A player can exist without a league --------------------------------
alter table public.players alter column league_id drop not null;

-- 2. Who made it ---------------------------------------------------------
--
-- A league shell is editable by any league member, which is the right rule
-- there: you are all in the same club and can all see the mistake. A
-- league-less shell has no club to appeal to, so it needs an owner, and
-- players has never recorded one.
--
-- Existing rows are left null. Null means "belongs to a league", and the
-- league policies below continue to govern those untouched.
alter table public.players add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists players_created_by_idx on public.players(created_by);

-- 3. Reading -------------------------------------------------------------
--
-- is_league_member(null) is not true, so without this a league-less row is
-- invisible to everybody including the person who made it.
--
-- League-less rows are readable by any signed-in account. They are names and
-- avatars, they are already reachable through search and profiles, and a
-- match you played against somebody has to be able to say who.
drop policy if exists "read players in your leagues" on public.players;

create policy "read players in your leagues"
  on public.players for select
  using (
    (league_id is not null and public.is_league_member(league_id))
    or (league_id is null and auth.uid() is not null)
  );

-- 4. Creating ------------------------------------------------------------
--
-- Into a league: unchanged, you must be a member.
-- Outside one: anybody signed in, but only stamped as themselves — so
-- created_by cannot be forged onto someone else.
drop policy if exists "add a player to your league" on public.players;

create policy "add a player to your league"
  on public.players for insert
  with check (
    (league_id is not null and public.is_league_member(league_id))
    or (
      league_id is null
      and auth.uid() is not null
      and (created_by is null or created_by = auth.uid())
    )
  );

-- 5. Editing -------------------------------------------------------------
--
-- The existing rule stands and is not weakened: a claimed row belongs to the
-- person who claimed it. This only adds the league-less case — your own row,
-- or a shell you made yourself.
--
-- Deliberately NOT "anybody signed in": a league-less shell is one person's
-- record of a mate, and letting a stranger rename it is how the Charlie
-- incident happens again with fewer witnesses.
drop policy if exists "edit a league-less player you own" on public.players;

create policy "edit a league-less player you own"
  on public.players for update
  using (
    league_id is null
    and auth.uid() is not null
    and (auth_id = auth.uid() or (auth_id is null and created_by = auth.uid()))
  )
  with check (
    league_id is null
    and auth.uid() is not null
    and (auth_id = auth.uid() or (auth_id is null and created_by = auth.uid()))
  );

-- 6. Deleting ------------------------------------------------------------
--
-- Only an unclaimed shell you made, and only while nothing references it.
-- A player with results is not a mistake to tidy away — deleting one would
-- orphan matches that two people agreed to.
drop policy if exists "remove a league-less shell you made" on public.players;

create policy "remove a league-less shell you made"
  on public.players for delete
  using (
    league_id is null
    and auth_id is null
    and created_by = auth.uid()
    and not exists (
      select 1 from public.matches m where m.p1 = players.id or m.p2 = players.id
    )
  );
