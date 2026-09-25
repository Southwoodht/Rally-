-- Rally — casual doubles (Part A of the doubles brief)
--
-- NOT RUN BY A CODING SESSION. Sam runs this.
--
-- TAKE A DATABASE BACKUP FIRST. This is additive and rewrites no existing
-- row, but it is the first migration to add a whole feature's tables to a
-- live database with real clubs in it.
--
-- ADDITIVE, all of it: two new columns on leagues with a default, one new
-- table, and policies on that new table only. Nothing existing is renamed,
-- dropped or rewritten, and singles cannot see any of it.
--
-- ============================================================================
-- WHAT IS NOT HERE, AND WHY
--
-- The brief also specified `doubles_rating_history` and stored per-player
-- doubles stats (doubles_elo seeded at 1500, played/won/lost, streaks).
-- Neither is here, and that follows from Sam's ruling to compute doubles the
-- way singles is computed rather than server-side.
--
-- Rally stores no rating anywhere. `players` has no elo, no W/L and no
-- streak; computeStats() replays every match on each render. That is what
-- makes a level history entered today regrade a 2019 match, and it is why
-- CLAUDE.md says nothing caches a computed value.
--
-- A stored doubles_elo would be a second, contradictory model: a cached
-- number beside a derivable one, which after any failed write disagrees with
-- the truth and gives no way to tell which is wrong. Deriving doubles Elo
-- from these rows in played_at order means "recompute after an edit" is not a
-- special path — it is the only path, and it cannot drift.
--
-- If a rating audit trail is wanted later ("you went 1532 -> 1542 in that
-- match"), it does not need a table: the same replay already produces every
-- intermediate value, which is exactly how singles answers it today via
-- computeStats's ratingBefore.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Feature flags
-- ---------------------------------------------------------------------------
-- Both default false, so running this file changes nothing anybody can see.
-- Sam turns them on per league, Seacourt first.

alter table public.leagues
  add column if not exists doubles_enabled boolean not null default false;

alter table public.leagues
  add column if not exists competitions_enabled boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. doubles_matches
-- ---------------------------------------------------------------------------
-- A SEPARATE TABLE, not a widened `matches`. 39 files and 361 references in
-- this codebase assume a match has exactly p1 and p2; a fifth column on
-- `matches` would be picked up by every one of them. Singles code cannot
-- read a row it does not select.
--
-- THE PLAYER COLUMNS ARE `text` AND THAT IS NOT A TYPO. players.id is the
-- app's own short id, not a uuid — matches.p1 and fixtures.p1 are text for
-- the same reason. This is the mismatch section 6 of CLAUDE.md records
-- against trophies.player_id, where every other reference in the table was a
-- uuid and the player one could not be. fixture_id is text for the same
-- reason: fixtures.id is text.
--
-- id is uuid because this table is new and nothing external quotes its ids.

create table if not exists public.doubles_matches (
  id                uuid primary key default gen_random_uuid(),
  league_id         uuid not null references public.leagues(id) on delete cascade,
  played_at         timestamptz not null,

  team_a_p1         text not null references public.players(id) on delete cascade,
  team_a_p2         text not null references public.players(id) on delete cascade,
  team_b_p1         text not null references public.players(id) on delete cascade,
  team_b_p2         text not null references public.players(id) on delete cascade,

  -- [{ "a": 6, "b": 4 }, { "a": 7, "b": 5 }] — set by set, in order.
  --
  -- Singles has nothing like this: its set scores live inside the free-text
  -- `score` column and are parsed back out by core/sets.ts, which has to
  -- reconcile them against the recorded winner because the old free text had
  -- no player-one-first convention. Doubles is structured from the start, so
  -- team A's games are always `a`. It is a better shape than singles', which
  -- is worth saying out loud: doubles must NOT be routed through the singles
  -- score parser.
  sets              jsonb not null,

  winner            text not null,
  status            text not null default 'confirmed',

  entered_by        text,
  confirmed_by      text,

  -- Part B. Null for casual doubles, which is everything in Part A.
  competition_id    uuid,
  team_a_pair_id    uuid,
  team_b_pair_id    uuid,

  fixture_id        text references public.fixtures(id) on delete set null,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- The four must be four different people.
  constraint doubles_matches_distinct_players check (
    team_a_p1 <> team_a_p2 and
    team_a_p1 <> team_b_p1 and
    team_a_p1 <> team_b_p2 and
    team_a_p2 <> team_b_p1 and
    team_a_p2 <> team_b_p2 and
    team_b_p1 <> team_b_p2
  ),

  -- 'draw' is allowed because singles allows it: matches.winner accepts
  -- 'draw' and computeStats scores it 0.5. The brief said to allow it only
  -- if singles does; singles does.
  constraint doubles_matches_winner check (winner in ('A', 'B', 'draw')),

  -- Mirrors the singles vocabulary. matches.status has no check constraint
  -- of its own, but core/matchStatus.ts treats an unrecognised status as
  -- played and says so loudly, so the set is known.
  constraint doubles_matches_status check (status in ('confirmed', 'pending', 'disputed')),

  -- At least one set, and each entry an object. The winner-matches-the-sets
  -- rule needs to count them, so it is in the trigger below rather than here.
  constraint doubles_matches_sets_shape check (
    jsonb_typeof(sets) = 'array' and jsonb_array_length(sets) >= 1
  )
);

create index if not exists doubles_matches_league_played_idx
  on public.doubles_matches (league_id, played_at);

-- One index per player column: the Partners card and every per-player stat
-- ask "every doubles match this person was in", which is four separate
-- lookups however it is phrased.
create index if not exists doubles_matches_a1_idx on public.doubles_matches (team_a_p1);
create index if not exists doubles_matches_a2_idx on public.doubles_matches (team_a_p2);
create index if not exists doubles_matches_b1_idx on public.doubles_matches (team_b_p1);
create index if not exists doubles_matches_b2_idx on public.doubles_matches (team_b_p2);

-- ---------------------------------------------------------------------------
-- 3. The two rules a CHECK cannot express
-- ---------------------------------------------------------------------------
-- A CHECK constraint cannot query another table, so "all four belong to this
-- league" has to be a trigger. So does "the winner matches the sets", which
-- has to count the array.
--
-- BOTH RAISE RATHER THAN SILENTLY CORRECTING. A doubles match with a player
-- from another league, or a winner that contradicts its own score, is a bug
-- somewhere upstream; writing it quietly is how the Charlie incident
-- happened.

create or replace function public.doubles_match_is_sane()
returns trigger
language plpgsql
as $$
declare
  wrong_league int;
  sets_a int;
  sets_b int;
  implied text;
begin
  select count(*) into wrong_league
  from public.players p
  where p.id in (new.team_a_p1, new.team_a_p2, new.team_b_p1, new.team_b_p2)
    and p.league_id is distinct from new.league_id;

  if wrong_league > 0 then
    raise exception 'All four players must belong to league %', new.league_id;
  end if;

  -- Four ids, four rows. A missing player is caught by the foreign keys, but
  -- a player row deleted between the FK check and here would not be.
  if (select count(*) from public.players p
      where p.id in (new.team_a_p1, new.team_a_p2, new.team_b_p1, new.team_b_p2)) <> 4 then
    raise exception 'All four players must exist';
  end if;

  select
    count(*) filter (where (s->>'a')::int > (s->>'b')::int),
    count(*) filter (where (s->>'b')::int > (s->>'a')::int)
  into sets_a, sets_b
  from jsonb_array_elements(new.sets) s;

  implied := case
    when sets_a > sets_b then 'A'
    when sets_b > sets_a then 'B'
    else 'draw'
  end;

  if implied <> new.winner then
    raise exception 'Winner % does not match the sets (% – %)', new.winner, sets_a, sets_b;
  end if;

  new.updated_at := now();
  return new;
end
$$;

revoke all on function public.doubles_match_is_sane() from public, anon;

drop trigger if exists doubles_match_is_sane_trg on public.doubles_matches;
create trigger doubles_match_is_sane_trg
  before insert or update on public.doubles_matches
  for each row execute function public.doubles_match_is_sane();

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
-- The same shape as matches: is_league_member to read, and a narrower rule to
-- write. Policies are dropped and recreated by name, so the file is safe to
-- re-run.

alter table public.doubles_matches enable row level security;

drop policy if exists "read doubles in your leagues" on public.doubles_matches;
create policy "read doubles in your leagues"
  on public.doubles_matches for select
  using (public.is_league_member(league_id));

-- YOU MUST BE ONE OF THE FOUR. Singles is looser than this — "log a match in
-- your league" lets any member record a match between two other people,
-- because a club secretary entering the week's results is a real thing. The
-- brief asks for the tighter rule on doubles and it is the right default for
-- a new feature; if Seacourt's admins need to enter doubles for other people
-- later, widen it then, deliberately.
drop policy if exists "log a doubles match you played in" on public.doubles_matches;
create policy "log a doubles match you played in"
  on public.doubles_matches for insert
  with check (
    public.is_league_member(league_id)
    and exists (
      select 1 from public.players p
      where p.id in (team_a_p1, team_a_p2, team_b_p1, team_b_p2)
        and p.auth_id = auth.uid()
    )
  );

-- The same two-branch shape as "participants and league staff can edit
-- matches" on singles: one of the four, matched by their own auth_id, or a
-- league owner/editor moderating. The table has to be named explicitly in
-- these clauses — an unqualified column here is both a column and, in some
-- contexts, something else, and section 6 records what that ambiguity costs
-- when it only shows up at call time.
drop policy if exists "participants and league staff can edit doubles" on public.doubles_matches;
create policy "participants and league staff can edit doubles"
  on public.doubles_matches for update
  using (
    exists (
      select 1 from public.players pl
      where pl.id in (doubles_matches.team_a_p1, doubles_matches.team_a_p2,
                      doubles_matches.team_b_p1, doubles_matches.team_b_p2)
        and pl.auth_id = auth.uid()
    )
    or exists (
      select 1 from public.league_members lm
      where lm.league_id = doubles_matches.league_id
        and lm.user_id = auth.uid() and lm.role in ('owner', 'editor')
    )
  );

-- DELETE is staff-only, exactly as singles is. Singles draws that line
-- because a match is a shared record and one participant should not be able
-- to erase the other's result; doubles has three other people with a stake,
-- so the argument is stronger, not weaker.
drop policy if exists "league staff can delete doubles" on public.doubles_matches;
create policy "league staff can delete doubles"
  on public.doubles_matches for delete
  using (
    exists (
      select 1 from public.league_members lm
      where lm.league_id = doubles_matches.league_id
        and lm.user_id = auth.uid() and lm.role in ('owner', 'editor')
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Verification — the column, the flags and the policies
-- ---------------------------------------------------------------------------
-- ONE statement, because the Supabase editor shows the last result only, and
-- it proves what THIS migration did rather than something that was already
-- true. schema_profile_theme.sql got that wrong: its closing select printed
-- the RLS policies, which would have looked identical had the add-column
-- never run.

select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'leagues'
      and column_name in ('doubles_enabled', 'competitions_enabled'))            as league_flags_added,
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'doubles_matches')            as doubles_table_exists,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'doubles_matches')            as doubles_columns,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'doubles_matches')               as doubles_policies,
  (select count(*) from pg_trigger
    where tgrelid = 'public.doubles_matches'::regclass and not tgisinternal)     as doubles_triggers;

-- Expect: 2 flags, 1 table, 18 columns, 4 policies, 1 trigger.
--
-- (This line said 19 when the file first went out, and Sam ran it and got 18.
-- 18 is correct — it is exactly the column list the brief specified — and the
-- miscount was in the comment, not the table. Recorded because a verification
-- select whose expected value is wrong is worse than none: it reports a
-- correct migration as a failure.)
--
-- THEN RUN supabase/fix_function_grants.sql. This file creates a function,
-- and section 6 of CLAUDE.md is explicit: Supabase grants EXECUTE on a new
-- function to anon by default, so every migration that creates one has to be
-- followed by the grants file. It is idempotent and costs nothing.
