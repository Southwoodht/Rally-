-- Rally — a profile anybody signed in can read
--
-- NOT RUN BY A CODING SESSION. Sam runs this. The app is written to work
-- without it — a profile shows name, photo, Message, Friend and Challenge
-- either way, and gains the record and recent matches once this exists.
--
-- WHAT THIS CHANGES ABOUT AN EXISTING RULE
--
-- CLAUDE.md §6 records global_standings() as "aggregate-only, and only for
-- people already visible to you — never another league's matches, opponents,
-- members or name". This deliberately relaxes that, because Sam asked for
-- Facebook-shaped profiles: any signed-in user finds anyone and opens them.
--
-- It is a real trade and worth stating plainly. After this, somebody in no
-- league at all can read any player's record and the names of the people
-- they have played. That is the point of the feature, and it is also how a
-- junior's opponents in a coach's league become visible to a stranger. If
-- that is not wanted, the `recent` block is the part to drop — the record
-- and form alone give away nothing but numbers.
--
-- Two additive pieces. No table is altered and no row is rewritten.

-- 1. Backfill the public photo -------------------------------------------
--
-- Photos have always been written to players.avatar_url, on the league row.
-- profiles.avatar_url is what everyone else can read and nothing has ever
-- written it. New photos now go to both; this catches the ones already
-- taken.
--
-- Only fills what is empty, so it can never overwrite a picture somebody
-- has deliberately set, and it is safe to run twice.

update public.profiles pr
   set avatar_url = pl.avatar_url
  from (
    select distinct on (auth_id) auth_id, avatar_url
      from public.players
     where auth_id is not null and avatar_url is not null
     order by auth_id, claimed_at desc nulls last, id
  ) pl
 where pr.id = pl.auth_id
   and pr.avatar_url is null;

-- 2. The card -------------------------------------------------------------

create or replace function public.public_player_card(p_auth_id uuid)
returns table (
  nick   text,
  level  jsonb,
  home   text,
  wins   int,
  draws  int,
  losses int,
  form   text[],
  recent jsonb,
  h2h_w  int,
  h2h_d  int,
  h2h_l  int
)
language plpgsql
security definer
set search_path = public
as $
-- The names in `returns table` above are also variables in here, so a bare
-- column with the same name — nick, level, home, wins, form, recent — is
-- ambiguous and raises at call time. This says columns win, and every
-- reference below is qualified anyway. Both, because this failed twice.
#variable_conflict use_column
begin
  return query
  with me as (
    -- Every league row this person owns. One human, several memberships.
    select p.id, p.nick, p.level, p.home, p.claimed_at
      from public.players p
     where p.auth_id = p_auth_id
  ),
  mine as (
    select m.*,
           case when m.p1 in (select id from me) then 'p1' else 'p2' end as my_side
      from public.matches m
     where m.status = 'confirmed'
       and (m.p1 in (select id from me) or m.p2 in (select id from me))
  ),
  you as (
    -- The caller. auth.uid() is available inside a security-definer
    -- function, which is what makes "you vs them" computable here rather
    -- than needing a second round trip that could not see both sides.
    select id from public.players where auth_id = auth.uid()
  ),
  between_us as (
    select m.*,
           case when m.p1 in (select id from you) then 'p1' else 'p2' end as your_side
      from public.matches m
     where m.status = 'confirmed'
       and (
         (m.p1 in (select id from you) and m.p2 in (select id from me))
         or (m.p2 in (select id from you) and m.p1 in (select id from me))
       )
  ),
  latest as (
    -- The most recently touched league row wins for the descriptive bits.
    -- Somebody in two clubs has two of each and we have to pick one.
    select me.nick, me.level, me.home from me order by me.claimed_at desc nulls last, me.id limit 1
  )
  select
    (select l.nick from latest l),
    (select to_jsonb(l.level) from latest l),
    (select l.home from latest l),
    (select count(*)::int from mine where winner = my_side),
    (select count(*)::int from mine where winner = 'draw'),
    (select count(*)::int from mine where winner <> 'draw' and winner <> my_side),
    (select coalesce(array_agg(x.r order by x.date desc), '{}')
       from (
         select case when winner = 'draw' then 'D'
                     when winner = my_side then 'W' else 'L' end as r, date
           from mine order by date desc limit 5
       ) x),
    (select coalesce(jsonb_agg(jsonb_build_object(
              'id', r.id,
              'date', r.date,
              'won', case when r.winner = 'draw' then null else (r.winner = r.my_side) end,
              'score', r.score,
              'opponent', trim(coalesce(op.name,'') || ' ' || coalesce(op.last,''))
            ) order by r.date desc), '[]'::jsonb)
       from (select * from mine order by date desc limit 100) r
       join public.players op
         on op.id = case when r.my_side = 'p1' then r.p2 else r.p1 end),
    (select count(*)::int from between_us where winner = your_side),
    (select count(*)::int from between_us where winner = 'draw'),
    (select count(*)::int from between_us where winner <> 'draw' and winner <> your_side);
end;
$$;

-- Signed-in accounts only. Never anon: a profile is public *within Rally*,
-- not on the open internet.
revoke all on function public.public_player_card(uuid) from public;
grant execute on function public.public_player_card(uuid) to authenticated;


-- 3. Search, including nicknames ------------------------------------------
--
-- searchProfiles() in the app queries `profiles` and so can only match a
-- display name. Nicknames live on `players.nick`, a league row, which a
-- stranger cannot read — so without this, searching "Cheese" finds nobody
-- unless you are already in their league, and searching the same word gives
-- different answers to different people.
--
-- Returns account ids only. The caller then reads those profiles through the
-- policies that already exist, so this widens what can be *found* without
-- widening what can be *read*.

create or replace function public.search_player_accounts(p_query text)
returns table (auth_id uuid)
language sql
security definer
set search_path = public
as $$
  select distinct p.auth_id
    from public.players p
   where p.auth_id is not null
     and p_query is not null
     and length(btrim(p_query)) >= 2
     and p.nick ilike '%' || btrim(p_query) || '%'
   limit 20;
$$;

revoke all on function public.search_player_accounts(text) from public;
grant execute on function public.search_player_accounts(text) to authenticated;
