-- Rally — who played whom, so the Global table can rank on the network
--
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
--
-- SAFE FOR DATA: creates one function. Writes no rows, changes no tables,
-- drops nothing, touches no policies. Safe to re-run. It does not replace
-- global_standings(); that keeps doing exactly what it does today, and this
-- sits alongside it.
--
-- WHY
--
-- Rank is not a summary statistic. Every attempt to build it out of win
-- counts and average opponent levels produced a table where somebody
-- finished above a player who had beaten them, because an average cannot
-- hold a chain: Zaach beat Sam, Sam beat Charlie, Charlie beat David. The
-- only fix is to rate people on the matches themselves.
--
-- So this returns the edges — one row per person per match: me, them, and
-- how it went. The app iterates over them until the ratings settle:
--
--     rating(p) = average rating of everyone p played + K * (p's rate - 0.5)
--
-- which holds the chain by construction. If Zaach beats Sam, Zaach lands
-- above Sam whatever Sam's rating turns out to be. Nobody needs a level for
-- it to work, so an unrated player with twenty-four matches gets a real
-- position instead of sitting wherever the neutral score puts them.
--
-- WHAT IT DOES NOT LEAK
--
-- The same rule as global_standings(): you only ever learn about people you
-- already share a league with. Their matches against players you *cannot*
-- see still count — a person's record shouldn't shrink because you can't see
-- half of it — but the opponent comes back as `opp_anon`, an opaque token,
-- with the real key nulled. The token is stable within one call so the graph
-- still connects, and it is salted per call so it cannot be matched up
-- between calls or against anything else. You learn that somebody won a
-- match; you learn nothing about who they beat or which league it was in.
--
-- No scores, dates, venues, notes or league names are returned by this at
-- all.

create or replace function public.global_edges()
returns table (
  key      text,     -- the person, same key global_standings() uses
  opp      text,     -- the opponent, when you can see them; null otherwise
  opp_anon text,     -- opaque stable token for the opponent within this call
  result   numeric   -- 1 won, 0.5 drew, 0 lost
)
language sql
stable
security definer
set search_path = public
as $$
  with salt as (
    -- New every call, so tokens can never be correlated across calls.
    select gen_random_uuid()::text as s
  ),
  visible as (
    select distinct coalesce(p.auth_id::text, 'p:' || p.id) as pkey
    from public.players p
    where public.is_league_member(p.league_id)
  ),
  person_rows as (
    select coalesce(p.auth_id::text, 'p:' || p.id) as pkey, p.id, p.league_id
    from public.players p
    where coalesce(p.auth_id::text, 'p:' || p.id) in (select v.pkey from visible v)
  )
  select r.pkey,
         case when ov.pkey is not null then okey.k end,
         md5(okey.k || (select salt.s from salt)),
         (case
            when m.winner = 'draw' then 0.5
            when (m.winner = 'p1' and m.p1 = r.id) or (m.winner = 'p2' and m.p2 = r.id) then 1
            else 0
          end)::numeric
  from person_rows r
  join public.matches m
    on (m.p1 = r.id or m.p2 = r.id)
   and m.status = 'confirmed'
  join public.players o
    on o.id = case when m.p1 = r.id then m.p2 else m.p1 end
  cross join lateral (select coalesce(o.auth_id::text, 'p:' || o.id) as k) okey
  left join visible ov on ov.pkey = okey.k;
$$;

revoke all on function public.global_edges() from public;
grant execute on function public.global_edges() to authenticated;

-- Sanity check — one row per player per confirmed match they played, so this
-- should come back as twice the number of confirmed matches involving anyone
-- you can see, and every result should be 1, 0.5 or 0.
--
--   select count(*) as edges,
--          count(*) filter (where opp is null) as against_someone_you_cannot_see,
--          min(result) as lowest, max(result) as highest
--   from public.global_edges();
