-- Rally — margin of victory in the Global table
--
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
--
-- SAFE FOR DATA: creates one function, replaces another. It reads matches
-- and players; it writes nothing, changes no rows, drops no tables and
-- touches no policies. Re-running it is harmless.
--
-- It does DROP AND RECREATE global_standings(), because the function gains
-- two output columns and Postgres won't let `create or replace` change a
-- return type. Nothing but the function itself is dropped, and the new one
-- is created in the same statement block moments later.
--
-- ORDER DOESN'T MATTER THIS TIME. The app reads the two new columns
-- defensively and falls back to plain win/loss when they aren't there, so
-- running this before or after the deploy both work. (Unlike
-- schema_level_val_18.sql, which had to land first.)
--
-- WHAT IT ADDS
--
-- Until now a quality result — one against an opponent at or above your own
-- level — counted 1 for a win and 0 for a loss, and the score was decoration.
-- Losing 6-5 to someone at your level counted exactly the same as losing
-- 0-6, 0-6, 0-6, which isn't true and everybody who played both knows it.
--
-- So this returns two extra aggregates over your scored quality matches:
--
--   qshare_sum  the sum of your share of games — 6-0,6-0,6-0 is 1.0, a
--               6-7,5-7 loss is 0.44, and a match with no score adds nothing
--   qres_sum    the sum of the plain 1/0.5/0 results for those same matches
--
-- The app combines them (see MARGIN_WEIGHT in src/lib/globalTable.ts). The
-- weight deliberately lives there and not here, so the balance between
-- "you won" and "by how much" can be tuned without another migration. This
-- function's job is to report facts, not to hold an opinion about them.
--
-- Matches with no score are untouched: they keep contributing their plain
-- result, so nobody is penalised for leaving the score box empty.

-- ------------------------------------------------------------ score_games
-- Total games each side took across every set of a score string, as written.
-- "6-2, 6-3, 6-2" -> {18,7}. Returns null for free text, an empty score, or
-- anything that isn't entirely made of "N-N" parts — mirroring parseSets()
-- in src/core/sets.ts, which refuses to guess at a score it can't read.
create or replace function public.score_games(score text)
returns int[]
language sql
immutable
as $$
  with parts as (
    select trim(p) as part
    from regexp_split_to_table(coalesce(score, ''), ',') as p
  ),
  matched as (
    select regexp_match(parts.part, '^([0-9]{1,3})\s*[-–—]\s*([0-9]{1,3})$') as g
    from parts
  )
  select case
           when count(*) = 0 or bool_or(matched.g is null) then null
           else array[ sum((matched.g[1])::int)::int, sum((matched.g[2])::int)::int ]
         end
  from matched;
$$;

-- --------------------------------------------------------- global_standings
drop function if exists public.global_standings();

create function public.global_standings()
returns table (
  key        text,
  name       text,
  last       text,
  nick       text,
  avatar     text,
  avatar_url text,
  level      jsonb,
  claimed    boolean,
  leagues    int,
  w          int,
  d          int,
  l          int,
  qw         int,
  qd         int,
  ql         int,
  qshare_sum numeric,  -- share of games taken, summed over scored quality matches
  qres_sum   numeric   -- plain 1/0.5/0 results, summed over those same matches
)
language sql
stable
security definer
set search_path = public
as $$
  with visible as (
    select distinct coalesce(p.auth_id::text, 'p:' || p.id) as pkey
    from public.players p
    where public.is_league_member(p.league_id)
  ),
  person_rows as (
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
           public.level_val(o.level) as opp_lv,
           public.score_games(m.score) as games,
           (m.p1 = r.id) as is_p1,
           m.winner as winner
    from person_rows r
    join public.matches m
      on (m.p1 = r.id or m.p2 = r.id)
     and m.status = 'confirmed'
    join public.players o
      on o.id = case when m.p1 = r.id then m.p2 else m.p1 end
  ),
  scored as (
    -- Orient the score to this person and turn it into their share of the
    -- games. The stored string has no reliable player-one-first convention
    -- (an old "6-4" sits on a match player two won), so the recorded result
    -- decides which way round it was meant. A score that can't be reconciled
    -- with the result — a 6-4 on a draw, or level games on a decided match —
    -- is dropped rather than guessed at.
    select x.*,
           case
             when x.games is null then null
             when x.games[1] + x.games[2] = 0 then null
             when x.winner = 'draw' then
               case when x.games[1] = x.games[2]
                    then 0.5::numeric else null end
             when x.games[1] = x.games[2] then null
             else (
               -- games[] as written, flipped if the higher total isn't the winner's
               with t as (
                 select case
                          when (x.res = 'W') = (x.games[1] > x.games[2])
                            then array[x.games[1], x.games[2]]
                          else array[x.games[2], x.games[1]]
                        end as mine_first
               )
               select (t.mine_first[1])::numeric / (t.mine_first[1] + t.mine_first[2])
               from t
             )
           end as my_share
    from results x
  ),
  agg as (
    select s.pkey,
      count(*) filter (where s.res = 'W')::int as aw,
      count(*) filter (where s.res = 'D')::int as ad,
      count(*) filter (where s.res = 'L')::int as al,
      count(*) filter (where s.res = 'W' and s.opp_lv is not null and s.my_lv is not null and s.opp_lv >= s.my_lv)::int as aqw,
      count(*) filter (where s.res = 'D' and s.opp_lv is not null and s.my_lv is not null and s.opp_lv >= s.my_lv)::int as aqd,
      count(*) filter (where s.res = 'L' and s.opp_lv is not null and s.my_lv is not null and s.opp_lv >= s.my_lv)::int as aql,
      coalesce(sum(s.my_share) filter (
        where s.my_share is not null and s.opp_lv is not null and s.my_lv is not null and s.opp_lv >= s.my_lv
      ), 0)::numeric as aqshare,
      coalesce(sum(case s.res when 'W' then 1 when 'D' then 0.5 else 0 end) filter (
        where s.my_share is not null and s.opp_lv is not null and s.my_lv is not null and s.opp_lv >= s.my_lv
      ), 0)::numeric as aqres
    from scored s
    group by s.pkey
  ),
  base as (
    select r.pkey,
      count(distinct r.league_id)::int as n_leagues,
      coalesce(sum((r.initial_record->>'w')::int), 0)::int as iw,
      coalesce(sum((r.initial_record->>'d')::int), 0)::int as idr,
      coalesce(sum((r.initial_record->>'l')::int), 0)::int as il
    from person_rows r
    group by r.pkey
  ),
  ident as (
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
         coalesce(a.aqw, 0), coalesce(a.aqd, 0), coalesce(a.aql, 0),
         coalesce(a.aqshare, 0), coalesce(a.aqres, 0)
  from ident i
  join base b on b.pkey = i.pkey
  left join agg a on a.pkey = i.pkey;
$$;

revoke all on function public.global_standings() from public;
grant execute on function public.global_standings() to authenticated;
grant execute on function public.score_games(text) to authenticated;

-- Sanity checks — these should come back as stated.
--
--   select public.score_games('6-2, 6-3, 6-2');   -- {18,7}
--   select public.score_games('6-4');             -- {6,4}
--   select public.score_games('12-2');            -- {12,2}
--   select public.score_games('came back from 4-1 down');  -- null
--   select public.score_games('');                -- null
--
-- And the table itself still returns a row per person:
--
--   select name, w, d, l, qw, qd, ql, qshare_sum, qres_sum
--   from public.global_standings() order by name;
