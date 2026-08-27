-- Rally — account profiles & friends
--
-- Additive migration. Run this once in Supabase: SQL Editor -> New query ->
-- paste -> Run. Doesn't touch leagues, players, matches, or anything else —
-- this is the new, separate "who is this Rally account" layer that Friends
-- and player search need, since a league's players table only knows about
-- people inside that one league.
--
-- Every signed-up account gets a row here automatically (via the trigger
-- below) with a short, shareable friend_code — like a league's join_code,
-- but for a person instead of a league.

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url   text,
  friend_code  text not null unique,
  created_at   timestamptz not null default now()
);

-- Same no-ambiguous-characters alphabet as leagues.join_code.
create or replace function public.generate_friend_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  exists_already boolean;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, floor(random() * length(alphabet) + 1)::int, 1);
    end loop;
    select exists(select 1 from public.profiles where friend_code = code) into exists_already;
    exit when not exists_already;
  end loop;
  return code;
end;
$$;

-- Every new auth user gets a profile row automatically — nothing in the
-- app has to remember to create one.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, friend_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'Player'),
    new.raw_user_meta_data->>'avatar_url',
    public.generate_friend_code()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for accounts that already exist (signed up before this
-- migration ran). Safe to run again — skips anyone who already has one.
insert into public.profiles (id, display_name, avatar_url, friend_code)
select u.id,
       coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1), 'Player'),
       u.raw_user_meta_data->>'avatar_url',
       public.generate_friend_code()
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

alter table public.profiles enable row level security;

drop policy if exists "any signed in user can search profiles" on public.profiles;
create policy "any signed in user can search profiles"
  on public.profiles for select
  using (auth.uid() is not null);

drop policy if exists "edit your own profile" on public.profiles;
create policy "edit your own profile"
  on public.profiles for update
  using (id = auth.uid());

-- ------------------------------------------------------------------ friends
create table if not exists public.friends (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references auth.users(id) on delete cascade,
  addressee_id  uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'pending',   -- pending | accepted
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  constraint friends_not_self check (requester_id <> addressee_id),
  constraint friends_unique_pair unique (requester_id, addressee_id)
);

create index if not exists friends_requester_idx on public.friends(requester_id);
create index if not exists friends_addressee_idx on public.friends(addressee_id);

alter table public.friends enable row level security;

drop policy if exists "read your own friendships" on public.friends;
create policy "read your own friendships"
  on public.friends for select
  using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists "send a friend request as yourself" on public.friends;
create policy "send a friend request as yourself"
  on public.friends for insert
  with check (requester_id = auth.uid() and status = 'pending');

-- Only the person who received the request can accept it.
drop policy if exists "addressee can accept a request" on public.friends;
create policy "addressee can accept a request"
  on public.friends for update
  using (addressee_id = auth.uid() and status = 'pending')
  with check (addressee_id = auth.uid() and status = 'accepted');

-- Cancel a request you sent, decline one you received, or unfriend someone
-- — all the same action from the database's point of view: either side of
-- the row can remove it.
drop policy if exists "either side can remove a friendship" on public.friends;
create policy "either side can remove a friendship"
  on public.friends for delete
  using (requester_id = auth.uid() or addressee_id = auth.uid());
