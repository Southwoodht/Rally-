-- Rally v1.0 Foundation — leagues schema
--
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
--
-- Two tables only. Players, matches and ratings come later; this is just
-- enough for "create a league" and "join a league with a code".

-- ---------------------------------------------------------------- leagues
create table if not exists public.leagues (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  location    text,
  join_code   text not null unique,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- --------------------------------------------------------- league_members
create table if not exists public.league_members (
  id         uuid primary key default gen_random_uuid(),
  league_id  uuid not null references public.leagues(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member',   -- owner | editor | member
  joined_at  timestamptz not null default now(),
  unique (league_id, user_id)
);

create index if not exists league_members_user_idx on public.league_members(user_id);

-- ------------------------------------------------------------------- RLS
-- Row Level Security: without these policies nobody can read or write
-- anything, even signed in. Postgres denies by default once RLS is on.

alter table public.leagues        enable row level security;
alter table public.league_members enable row level security;

-- A helper that avoids policies referencing each other in a loop.
create or replace function public.is_league_member(l_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.league_members
    where league_id = l_id and user_id = auth.uid()
  );
$$;

-- Leagues -----------------------------------------------------------------
drop policy if exists "read leagues you belong to" on public.leagues;
create policy "read leagues you belong to"
  on public.leagues for select
  using (public.is_league_member(id) or created_by = auth.uid());

-- Needed so a join-by-code lookup can find the league before you're a member.
drop policy if exists "find a league by its code" on public.leagues;
create policy "find a league by its code"
  on public.leagues for select
  using (true);

drop policy if exists "create your own league" on public.leagues;
create policy "create your own league"
  on public.leagues for insert
  with check (created_by = auth.uid());

drop policy if exists "owner can update league" on public.leagues;
create policy "owner can update league"
  on public.leagues for update
  using (created_by = auth.uid());

-- Members -----------------------------------------------------------------
drop policy if exists "read members of your leagues" on public.league_members;
create policy "read members of your leagues"
  on public.league_members for select
  using (user_id = auth.uid() or public.is_league_member(league_id));

drop policy if exists "join a league as yourself" on public.league_members;
create policy "join a league as yourself"
  on public.league_members for insert
  with check (user_id = auth.uid());

drop policy if exists "leave a league" on public.league_members;
create policy "leave a league"
  on public.league_members for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------- shared storage
create table if not exists public.shared_storage (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_storage (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.shared_storage enable row level security;
alter table public.user_storage enable row level security;

drop policy if exists "any signed in user can read shared storage" on public.shared_storage;
create policy "any signed in user can read shared storage"
  on public.shared_storage for select
  using (auth.uid() is not null);

drop policy if exists "any signed in user can write shared storage" on public.shared_storage;
create policy "any signed in user can write shared storage"
  on public.shared_storage for insert
  with check (auth.uid() is not null);

drop policy if exists "any signed in user can update shared storage" on public.shared_storage;
create policy "any signed in user can update shared storage"
  on public.shared_storage for update
  using (auth.uid() is not null);

drop policy if exists "any signed in user can delete shared storage" on public.shared_storage;
create policy "any signed in user can delete shared storage"
  on public.shared_storage for delete
  using (auth.uid() is not null);

drop policy if exists "users can read their own storage" on public.user_storage;
create policy "users can read their own storage"
  on public.user_storage for select
  using (user_id = auth.uid());

drop policy if exists "users can write their own storage" on public.user_storage;
create policy "users can write their own storage"
  on public.user_storage for insert
  with check (user_id = auth.uid());

drop policy if exists "users can update their own storage" on public.user_storage;
create policy "users can update their own storage"
  on public.user_storage for update
  using (user_id = auth.uid());

drop policy if exists "users can delete their own storage" on public.user_storage;
create policy "users can delete their own storage"
  on public.user_storage for delete
  using (user_id = auth.uid());
