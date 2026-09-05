-- Rally — let the Global table see how close a match was
--
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
--
-- SAFE FOR DATA: drops and recreates one function. Writes no rows, changes
-- no tables, touches no policies. Safe to re-run.
--
-- It must DROP rather than CREATE OR REPLACE: the function gains a column,
-- and Postgres won't let a replace change a return type. For the second or
-- two between the two statements the RPC is missing, the app falls back to
-- the old maths, and the next load picks the new one up. Nothing to undo.
--
-- WHY
--
-- global_edges() has been returning 1, 0.5 or 0 — won, drew, lost. So a 6-5
-- and a 6-0 were the same loss, and the score box, which people have been
-- filling in, changed precisely nothing. Losing 6-5 to somebody strong is a
-- different match from being brushed aside by them, and the whole point of
-- writing the score down is that the table can tell.
--
-- The weighting is NOT here. This returns the score exactly as it was typed
-- and the app decides what it's worth (MARGIN_WEIGHT in core/constants.ts,
-- resolved through core/sets.ts, which reads the numbers as written and
-- refuses any score it can't reconcile with the recorded result). Same rule
-- as everywhere else: the database reports what happened, the app decides
-- what it means, and retuning needs no migration.
--
-- WHAT IT STILL DOES NOT LEAK
--
-- The score comes back only when you can already see the opponent — i.e. for
-- matches inside a league you're in, where you can read the score anyway.
-- Against somebody outside your view you still get the bare result and the
-- opaque token, exactly as before. So this adds nothing to what you can
-- learn about a stranger: their record still counts in full, their margins
-- simply don't, and no dates, venues, notes or league names are returned by
-- this at all.

drop function if exists public.global_edges();

create function public.global_edges()
returns table (
  key      text,     -- the person, same key global_standings() uses
  opp      text,     -- the opponent, when you can see them; null otherwise
  opp_anon text,     -- opaque stable token for the opponent within this call
  result   numeric,  -- 1 won, 0.5 drew, 0 lost
  score    text      -- as typed, and only for opponents you can already see
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
          end)::numeric,
         case when ov.pkey is not null then nullif(btrim(coalesce(m.score, '')), '') end
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

-- Sanity check — how many of your edges now carry a score:
--
--   select count(*) as edges,
--          count(score) as with_a_score,
--          count(*) filter (where opp is null) as against_someone_you_cannot_see
--   from public.global_edges();
