-- Rally — the league behind a profile, so a stranger sees the same screen
--
-- NOT RUN BY A CODING SESSION. Sam runs this.
--
-- WHY THIS EXISTS
--
-- Opening Charlie Henry from Sam's own account shows the full profile —
-- rankings, best wins, achievements, rating deltas, the lot. Opening Samuel
-- Henry from an account in no league shows a reduced version, and Sam has
-- asked three times why.
--
-- The answer is not that data is missing. It is that the rich profile is
-- computed in the browser from the whole league: ProfileContainer takes
-- players and matches and runs computeStats over them, and a viewer who is
-- not in that league has never been allowed to load either.
--
-- So rather than keep rebuilding a thinner copy of that screen, this returns
-- the league. The existing component then produces the identical profile,
-- because it is the identical code running on the identical input.
--
-- WHAT IT EXPOSES — read this before running it
--
-- Any signed-in account can read the full roster and confirmed match history
-- of any league that has a member whose profile they are viewing. Names,
-- levels, avatars, and who beat whom.
--
-- That is an increment on what public_player_card() already gives away
-- rather than a new category — that function already returns a person's
-- matches *and their opponents' names*. What is new is the matches between
-- other pairs in the same league.
--
-- If that is further than Sam wants to go, the answer is not to trim this
-- function: it is to not run it, and accept that a stranger's profile is a
-- summary. The two cannot both be true.
--
-- Confirmed matches only. A pending result is one person's claim and is not
-- somebody else's business until it is agreed.

create or replace function public.public_league_snapshot(p_auth_id uuid)
returns table (players jsonb, matches jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league uuid;
begin
  -- The league they are most active in, which is the one their profile is
  -- really about. Somebody in two clubs has two profiles' worth of results
  -- and we have to pick the one that says most.
  select m.league_id into v_league
    from public.matches m
    join public.players p on p.id in (m.p1, m.p2)
   where p.auth_id = p_auth_id
     and m.league_id is not null
     and m.status = 'confirmed'
   group by m.league_id
   order by count(*) desc
   limit 1;

  if v_league is null then
    -- No league matches at all. Nothing to snapshot; the caller falls back
    -- to the summary, which is the right answer for somebody who has only
    -- ever played friendlies.
    return query select '[]'::jsonb, '[]'::jsonb;
    return;
  end if;

  return query
  select
    (select coalesce(jsonb_agg(to_jsonb(pl) order by pl.id), '[]'::jsonb)
       from public.players pl where pl.league_id = v_league),
    (select coalesce(jsonb_agg(to_jsonb(mt) order by mt.date), '[]'::jsonb)
       from public.matches mt
      where mt.league_id = v_league and mt.status = 'confirmed');
end;
$$;

-- Signed-in accounts only. Never anon.
revoke all on function public.public_league_snapshot(uuid) from public;
grant execute on function public.public_league_snapshot(uuid) to authenticated;
