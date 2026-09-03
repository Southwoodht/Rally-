-- Rally — the Global table
--
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Additive and read-only: it creates two functions and changes no data,
-- no tables and no existing policies. Safe to re-run.
--
-- WHY THIS EXISTS
--
-- Every other table in Rally is league-scoped, and rightly so. But that
-- makes one flat cross-league table dishonest. If Zaach plays Bob, Bob gets
-- a player row in *our* league holding exactly one result — the one he
-- lost — so he sits bottom on 0-1. Meanwhile Bob is 100-0 in his own league
-- against semi-pros. Ranking him on the single match we happen to have seen
-- is an artefact of where he entered, not a record.
--
-- So the Global table doesn't rank people on their matches against us. It
-- ranks them on *their own* matches, wherever those were played. Bob arrives
-- carrying his 100-0 and lands above Zaach, which is the truth.
--
-- HOW PEOPLE ARE MATCHED ACROSS LEAGUES
--
-- players rows are per-league, so "Bob in our league" and "Bob in his
-- league" are two different rows. The only thing that reliably ties them to
-- the same human is auth_id — set when someone claims their profile. So:
--
--   * claimed players   -> rows merge on auth_id, full cross-league record
--   * unclaimed players -> only what our own leagues know about them
--
-- We deliberately do NOT match on name. That is the exact bug that caused
-- the Charlie incident (see commit 74aac08); two people called Bob are two
-- people. The upside is a real incentive: claim your profile and your actual
-- record shows up instead of the sliver we saw.
--
-- WHAT THIS EXPOSES, AND WHAT IT DOESN'T
--
-- security definer means these functions read past RLS, so read carefully.
-- A caller only ever gets rows for people already visible to them — someone
-- who shares a league with them. For those people it returns aggregate
-- counts only: total W/D/L, how many leagues they play in, and how they do
-- against opponents at or above their own level. It never returns another
-- league's match rows, scores, dates, opponents, member list, or even its
-- name. You learn that Bob is 100-1 somewhere; you learn nothing about who
-- he beat or where.
--
-- Every column reference below is table-qualified and no CTE column is named
-- after one of this function's output columns. In a security definer SQL
-- function those output names are in scope inside the body, and a bare
-- `key` or `name` would be ambiguous against the table it came from.

-- ---------------------------------------------------------------- level_val
-- Mirrors levelVal() in src/core/levels.ts: category index * 3 + sub index.
-- Returns null for an unrated or unrecognised level rather than guessing, so
-- callers can tell "no level" apart from "Beginner Low".
--
-- NOTE: if LEVELS in src/core/constants.ts changes (e.g. the six-category,
-- 18-point scale), this array must change with it or the Global table's
-- quality column silently disagrees with the rest of the app.
create or replace function public.level_val(lv jsonb)
returns int
language sql
immutable
as $$
  select (array_position(array['Beginner','Intermediate','Advanced','Pro'], lv->>'cat') - 1) * 3
       + (array_position(array['Low','Medium','High'], lv->>'sub') - 1);
$$;

-- --------------------------------------------------------- global_standings
create or replace function public.global_standings()
returns table (
  key        text,     -- one row per person: auth id, or 'p:<player id>' if unclaimed
  name       text,
  last       text,
  nick       text,
  avatar     text,
  avatar_url text,
  level      jsonb,
  claimed    boolean,
  leagues    int,      -- how many leagues they play in
  w          int,
  d          int,
  l          int,
  qw         int,      -- against opponents at or above their own level
  qd         int,
  ql         int
)
language sql
stable
security definer
set search_path = public
as $$
  with visible as (
    -- The people you're allowed to see at all: anyone in a league you're in.
    select distinct coalesce(p.auth_id::text, 'p:' || p.id) as pkey
    from public.players p
    where public.is_league_member(p.league_id)
  ),
  person_rows as (
    -- Every player row belonging to those people, across all leagues. This
    -- is the one place we intentionally read past league scope.
    select coalesce(p.auth_id::text, 'p:' || p.id) as pkey, p.*
    from public.players p
    where coalesce(p.auth_id::text, 'p:' || p.id) in (select v.pkey from visible v)
  ),
  results as (
    select r.pkey,
           case
             when m.winner = 'draw' then 'D'
             when (m.winner = 'p1' and m.p1 = r.id) or (m.winner = 'p2' and m.p2 = r.id) then 'W'
             else 'L'
           end as res,
           public.level_val(r.level) as my_lv,
           public.level_val(o.level) as opp_lv
    from person_rows r
    join public.matches m
      on (m.p1 = r.id or m.p2 = r.id)
     and m.status = 'confirmed'
    join public.players o
      on o.id = case when m.p1 = r.id then m.p2 else m.p1 end
  ),
  agg as (
    select x.pkey,
      count(*) filter (where x.res = 'W')::int as aw,
      count(*) filter (where x.res = 'D')::int as ad,
      count(*) filter (where x.res = 'L')::int as al,
      count(*) filter (where x.res = 'W' and x.opp_lv is not null and x.my_lv is not null and x.opp_lv >= x.my_lv)::int as aqw,
      count(*) filter (where x.res = 'D' and x.opp_lv is not null and x.my_lv is not null and x.opp_lv >= x.my_lv)::int as aqd,
      count(*) filter (where x.res = 'L' and x.opp_lv is not null and x.my_lv is not null and x.opp_lv >= x.my_lv)::int as aql
    from results x
    group by x.pkey
  ),
  base as (
    -- Carried-in records from before the app existed count towards the
    -- total, exactly as they do on a profile.
    select r.pkey,
      count(distinct r.league_id)::int as n_leagues,
      coalesce(sum((r.initial_record->>'w')::int), 0)::int as iw,
      coalesce(sum((r.initial_record->>'d')::int), 0)::int as idr,
      coalesce(sum((r.initial_record->>'l')::int), 0)::int as il
    from person_rows r
    group by r.pkey
  ),
  ident as (
    -- Their claimed row wins the display fields, then the most recently
    -- updated one, so a person's own name and photo beat whatever someone
    -- else typed in when adding them.
    select distinct on (r.pkey)
      r.pkey,
      r.name       as p_name,
      r.last       as p_last,
      r.nick       as p_nick,
      r.avatar     as p_avatar,
      r.avatar_url as p_avatar_url,
      r.level      as p_level,
      (r.auth_id is not null) as p_claimed
    from person_rows r
    order by r.pkey, (r.auth_id is not null) desc, r.updated_at desc
  )
  select i.pkey,
         i.p_name, i.p_last, i.p_nick, i.p_avatar, i.p_avatar_url, i.p_level, i.p_claimed,
         b.n_leagues,
         coalesce(a.aw, 0) + b.iw,
         coalesce(a.ad, 0) + b.idr,
         coalesce(a.al, 0) + b.il,
         coalesce(a.aqw, 0), coalesce(a.aqd, 0), coalesce(a.aql, 0)
  from ident i
  join base b on b.pkey = i.pkey
  left join agg a on a.pkey = i.pkey;
$$;

revoke all on function public.global_standings() from public;
grant execute on function public.global_standings() to authenticated;
grant execute on function public.level_val(jsonb) to authenticated;
