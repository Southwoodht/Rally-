-- Rally — clubs & verified trophies
--
-- Additive migration. Run this once in Supabase: SQL Editor -> New query ->
-- paste -> Run. Doesn't touch leagues, league_members, shared_storage or
-- user_storage — those are untouched by this file.
--
-- Achievements (first win, streaks, season podium, etc.) stay 100%
-- client-computed from real match data — see src/core/achievements.ts.
-- Nothing here changes that. This migration is only for the NEW concept:
-- a "Trophy" is a real competitive honour that a club administrator has
-- verified, not something a player can award themselves.

-- ------------------------------------------------------------------- clubs
create table if not exists public.clubs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  location    text,
  join_code   text not null unique,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------- club_members
create table if not exists public.club_members (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member',   -- admin | member
  joined_at  timestamptz not null default now(),
  unique (club_id, user_id)
);

create index if not exists club_members_user_idx on public.club_members(user_id);

-- --------------------------------------------------------------- trophies
-- A claim starts 'pending' with verified_by/verified_at null. Only a club
-- admin's update can move it to 'approved'/'rejected' and stamp who did it
-- — enforced by RLS below, not just app logic, so a player can never
-- self-award one even by calling the API directly.
-- Same table serves two kinds of claim, distinguished by `kind`:
--   'trophy'      — a real competitive honour (competition/category/season/result)
--   'legacy_fact' — a claim about a player's own career (fact_type/fact_value),
--                   e.g. fact_type='started_playing', fact_value='2017'.
-- One review flow, one set of RLS rules, for both — a player can't self-verify
-- either kind any more than the other.
create table if not exists public.trophies (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null default 'trophy',   -- trophy | legacy_fact
  claimed_by   uuid not null references auth.users(id) on delete cascade,
  claimant_name text,   -- display label only, snapshotted at claim time — there's
                        -- no public profiles table to look a name up from later.
                        -- Identity is still claimed_by (the real auth id), never this.
  club_id      uuid not null references public.clubs(id) on delete cascade,
  league_id    uuid references public.leagues(id) on delete set null,
  competition  text,
  category     text,
  season       text,
  result       text,
  fact_type    text,
  fact_value   text,
  notes        text,
  status       text not null default 'pending',   -- pending | approved | rejected
  verified_by  uuid references auth.users(id),
  verified_at  timestamptz,
  created_at   timestamptz not null default now(),
  constraint trophies_kind_shape check (
    (kind = 'trophy' and competition is not null)
    or (kind = 'legacy_fact' and fact_type is not null and fact_value is not null)
  )
);

create index if not exists trophies_claimed_by_idx on public.trophies(claimed_by);
create index if not exists trophies_club_idx on public.trophies(club_id, status);

-- ------------------------------------------------------------------- RLS
alter table public.clubs         enable row level security;
alter table public.club_members  enable row level security;
alter table public.trophies      enable row level security;

create or replace function public.is_club_member(c_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.club_members
    where club_id = c_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_club_admin(c_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.club_members
    where club_id = c_id and user_id = auth.uid() and role = 'admin'
  );
$$;

-- Clubs ---------------------------------------------------------------------
drop policy if exists "read clubs you belong to" on public.clubs;
create policy "read clubs you belong to"
  on public.clubs for select
  using (public.is_club_member(id) or created_by = auth.uid());

drop policy if exists "find a club by its code" on public.clubs;
create policy "find a club by its code"
  on public.clubs for select
  using (true);

drop policy if exists "create your own club" on public.clubs;
create policy "create your own club"
  on public.clubs for insert
  with check (created_by = auth.uid());

drop policy if exists "admin can update club" on public.clubs;
create policy "admin can update club"
  on public.clubs for update
  using (created_by = auth.uid() or public.is_club_admin(id));

-- Club members ----------------------------------------------------------------
drop policy if exists "read members of your clubs" on public.club_members;
create policy "read members of your clubs"
  on public.club_members for select
  using (user_id = auth.uid() or public.is_club_member(club_id));

-- Self-insert is only ever as a plain member — otherwise anyone could grant
-- themselves 'admin' on someone else's club_id and approve their own
-- trophy claims. The one exception is the club's own creator becoming its
-- first admin, which is its own narrower policy right below.
drop policy if exists "join a club as yourself" on public.club_members;
create policy "join a club as yourself"
  on public.club_members for insert
  with check (user_id = auth.uid() and role = 'member');

drop policy if exists "creator becomes club admin" on public.club_members;
create policy "creator becomes club admin"
  on public.club_members for insert
  with check (
    user_id = auth.uid() and role = 'admin'
    and exists (select 1 from public.clubs where id = club_id and created_by = auth.uid())
  );

drop policy if exists "leave a club" on public.club_members;
create policy "leave a club"
  on public.club_members for delete
  using (user_id = auth.uid());

-- Trophies --------------------------------------------------------------------
-- Read: the claimant sees their own claim at any status; a club admin sees
-- every claim for their club; everyone signed in can see approved ones
-- (same "any signed-in user can read" openness the rest of the app already
-- uses for shared_storage — this is a mates'-league product, not a locked-down
-- one, and an approved trophy is meant to be shown on a public-ish profile).
drop policy if exists "read own claims, club admin claims, or approved" on public.trophies;
create policy "read own claims, club admin claims, or approved"
  on public.trophies for select
  using (
    claimed_by = auth.uid()
    or public.is_club_admin(club_id)
    or status = 'approved'
  );

-- Insert: only ever as a fresh pending claim for yourself. Can't insert
-- something already approved/verified — that would be self-awarding.
drop policy if exists "submit your own pending claim" on public.trophies;
create policy "submit your own pending claim"
  on public.trophies for insert
  with check (claimed_by = auth.uid() and status = 'pending' and verified_by is null);

-- Update: the claimant can only edit their own claim while it's still
-- pending (e.g. fix a typo before review) — the WITH CHECK stops them
-- moving it out of 'pending' or touching verified_by/verified_at themselves.
-- A club admin can update any claim for their club, which is how
-- approve/reject actually happens.
drop policy if exists "claimant edits own pending claim" on public.trophies;
create policy "claimant edits own pending claim"
  on public.trophies for update
  using (claimed_by = auth.uid() and status = 'pending')
  with check (claimed_by = auth.uid() and status = 'pending' and verified_by is null);

drop policy if exists "club admin reviews claims" on public.trophies;
create policy "club admin reviews claims"
  on public.trophies for update
  using (public.is_club_admin(club_id));

-- Delete: withdraw your own claim before it's reviewed.
drop policy if exists "withdraw your own pending claim" on public.trophies;
create policy "withdraw your own pending claim"
  on public.trophies for delete
  using (claimed_by = auth.uid() and status = 'pending');
