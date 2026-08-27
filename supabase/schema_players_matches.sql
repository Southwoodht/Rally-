-- Rally — players & matches as real tables
--
-- Additive migration. Run this once in Supabase: SQL Editor -> New query ->
-- paste -> Run. Does NOT touch shared_storage, leagues, or league_members —
-- your existing blob data is left completely alone. This just creates the
-- new tables alongside it. The app keeps reading the old blob until a
-- separate backfill + code deploy switches it over, so nothing changes for
-- players until that's done and verified.
--
-- Why: shared_storage stored an entire league's players+matches as one JSON
-- blob per row, so a single bad write could — and once did — wipe
-- everything at once. It also meant the database could only gate access to
-- a whole league's data, never to one player's own profile. These tables
-- fix both: one row per player/match, and RLS that actually enforces "once
-- a player is claimed, only that person can edit their own profile fields."
--
-- IDs are kept as the same short text ids the app already generates
-- (uid() in src/lib/format.ts, e.g. "96zp33j8") rather than switched to
-- uuid, so the backfill script can carry over every existing player and
-- match id unchanged — nothing in the app's existing match/player
-- references needs remapping.

-- ------------------------------------------------------------------ players
create table if not exists public.players (
  id             text primary key,
  league_id      uuid not null references public.leagues(id) on delete cascade,
  name           text not null,
  last           text,
  nick           text,
  age            text,
  home           text,
  level          jsonb,              -- { cat, sub } or null
  level_history  jsonb,              -- [{ cat, sub, from, to }]
  avatar         text,               -- emoji
  avatar_url     text,               -- uploaded photo (data URL)
  auth_id        uuid references auth.users(id) on delete set null,
  claimed_at     timestamptz,
  inactive       boolean not null default false,
  initial_record jsonb,              -- { w, d, l }
  initial_elo    numeric,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists players_league_idx on public.players(league_id);
create index if not exists players_auth_idx on public.players(auth_id);

-- ------------------------------------------------------------------ matches
create table if not exists public.matches (
  id           text primary key,
  league_id    uuid not null references public.leagues(id) on delete cascade,
  p1           text not null references public.players(id) on delete cascade,
  p2           text not null references public.players(id) on delete cascade,
  date         timestamptz not null,
  winner       text not null,        -- 'p1' | 'p2' | 'draw'
  score        text,
  status       text not null default 'confirmed',   -- confirmed | pending
  -- Attribution only, not a real relationship — old matches can reference a
  -- reporter id that no longer exists in the current roster (e.g. after an
  -- account was reconciled under a different player id), and that's fine;
  -- we still want to preserve who it was, not force it to resolve.
  reported_by  text,
  notes        text,
  venue        text,
  photo_url    text,
  category     text,
  pending_edit jsonb,                -- proposed change awaiting agreement, or null
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists matches_league_idx on public.matches(league_id);
create index if not exists matches_p1_idx on public.matches(p1);
create index if not exists matches_p2_idx on public.matches(p2);

-- Repairs a table already created by an earlier run of this script, back
-- when reported_by still had the foreign key. Harmless no-op otherwise.
alter table public.matches drop constraint if exists matches_reported_by_fkey;

-- ----------------------------------------------------------------- fixtures
create table if not exists public.fixtures (
  id         text primary key,
  league_id  uuid not null references public.leagues(id) on delete cascade,
  p1         text not null references public.players(id) on delete cascade,
  p2         text not null references public.players(id) on delete cascade,
  done       boolean not null default false,
  winner     text,
  match_id   text references public.matches(id) on delete set null,
  booked     timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists fixtures_league_idx on public.fixtures(league_id);

-- -------------------------------------------------------------------- posts
create table if not exists public.posts (
  id              text primary key,
  league_id       uuid not null references public.leagues(id) on delete cascade,
  by_player_id    text references public.players(id) on delete set null,
  text            text not null,
  is_announcement boolean not null default false,
  date            timestamptz not null default now()
);

create index if not exists posts_league_idx on public.posts(league_id);

-- ------------------------------------------------------------------- RLS
alter table public.players  enable row level security;
alter table public.matches  enable row level security;
alter table public.fixtures enable row level security;
alter table public.posts    enable row level security;

-- Players -------------------------------------------------------------------
drop policy if exists "read players in your leagues" on public.players;
create policy "read players in your leagues"
  on public.players for select
  using (public.is_league_member(league_id));

drop policy if exists "add a player to your league" on public.players;
create policy "add a player to your league"
  on public.players for insert
  with check (public.is_league_member(league_id));

-- The core ask: once a player is claimed (auth_id set), only that person
-- can edit it. An unclaimed shell can be edited by any league member (same
-- as today). This USING/WITH CHECK pair also covers claiming itself —
-- turning an unclaimed player's auth_id into your own — but never lets
-- anyone set auth_id to someone else's id.
drop policy if exists "edit unclaimed players, or your own claimed one" on public.players;
create policy "edit unclaimed players, or your own claimed one"
  on public.players for update
  using (
    public.is_league_member(league_id)
    and (auth_id is null or auth_id = auth.uid())
  )
  with check (
    public.is_league_member(league_id)
    and (auth_id is null or auth_id = auth.uid())
  );

drop policy if exists "remove unclaimed players, or your own" on public.players;
create policy "remove unclaimed players, or your own"
  on public.players for delete
  using (
    public.is_league_member(league_id)
    and (auth_id is null or auth_id = auth.uid())
  );

-- Matches ---------------------------------------------------------------------
drop policy if exists "read matches in your leagues" on public.matches;
create policy "read matches in your leagues"
  on public.matches for select
  using (public.is_league_member(league_id));

drop policy if exists "log a match in your league" on public.matches;
create policy "log a match in your league"
  on public.matches for insert
  with check (public.is_league_member(league_id));

-- A participant (one of p1/p2, matched by their own auth_id) can edit their
-- own match. A league owner/editor can moderate any match in their league.
-- Someone who isn't in the match and isn't an owner/editor cannot touch it.
drop policy if exists "participants and league staff can edit matches" on public.matches;
create policy "participants and league staff can edit matches"
  on public.matches for update
  using (
    exists (
      select 1 from public.players pl
      where pl.id in (matches.p1, matches.p2) and pl.auth_id = auth.uid()
    )
    or exists (
      select 1 from public.league_members lm
      where lm.league_id = matches.league_id and lm.user_id = auth.uid() and lm.role in ('owner', 'editor')
    )
  );

drop policy if exists "league staff can delete matches" on public.matches;
create policy "league staff can delete matches"
  on public.matches for delete
  using (
    exists (
      select 1 from public.league_members lm
      where lm.league_id = matches.league_id and lm.user_id = auth.uid() and lm.role in ('owner', 'editor')
    )
  );

-- Fixtures ----------------------------------------------------------------
drop policy if exists "read fixtures in your leagues" on public.fixtures;
create policy "read fixtures in your leagues"
  on public.fixtures for select
  using (public.is_league_member(league_id));

drop policy if exists "manage fixtures in your league" on public.fixtures;
create policy "manage fixtures in your league"
  on public.fixtures for insert
  with check (public.is_league_member(league_id));

drop policy if exists "update fixtures in your league" on public.fixtures;
create policy "update fixtures in your league"
  on public.fixtures for update
  using (public.is_league_member(league_id));

drop policy if exists "league staff can delete fixtures" on public.fixtures;
create policy "league staff can delete fixtures"
  on public.fixtures for delete
  using (
    exists (
      select 1 from public.league_members lm
      where lm.league_id = fixtures.league_id and lm.user_id = auth.uid() and lm.role in ('owner', 'editor')
    )
  );

-- Posts ---------------------------------------------------------------------
drop policy if exists "read posts in your leagues" on public.posts;
create policy "read posts in your leagues"
  on public.posts for select
  using (public.is_league_member(league_id));

drop policy if exists "post as your own player" on public.posts;
create policy "post as your own player"
  on public.posts for insert
  with check (
    public.is_league_member(league_id)
    and (
      by_player_id is null
      or exists (select 1 from public.players pl where pl.id = by_player_id and pl.auth_id = auth.uid())
    )
  );

drop policy if exists "remove your own post, or league staff" on public.posts;
create policy "remove your own post, or league staff"
  on public.posts for delete
  using (
    exists (select 1 from public.players pl where pl.id = by_player_id and pl.auth_id = auth.uid())
    or exists (
      select 1 from public.league_members lm
      where lm.league_id = posts.league_id and lm.user_id = auth.uid() and lm.role in ('owner', 'editor')
    )
  );
