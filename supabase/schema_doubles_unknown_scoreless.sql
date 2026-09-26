-- Rally — a doubles result with an unknown player, or with no score
--
-- NOT RUN BY A CODING SESSION. Sam runs this, then fix_function_grants.sql.
--
-- Sam, 26 Sep 2026: "should be able to save a result even if the actual
-- result or a player isn't put in ... some opponents' partners I don't know."
--
-- LOOSENS, NEVER REWRITES. No existing row is touched and no policy changes.
-- Every row already in doubles_matches has four players and at least one
-- set, which is still allowed; this only lets new rows have less.
--
-- 1. THE SECOND SEAT ON EACH TEAM MAY BE EMPTY.
--    Null means "somebody nobody could name". Only team_a_p2 and team_b_p2:
--    team_a_p1 is whoever entered it and team_b_p1 is the opponent they did
--    know, so a match always has at least one real person a side.
--    The app counts an empty seat as 1500 in the team average -- where every
--    new player starts -- and never rates it or lists it (Sam's ruling).
--    It is NOT a shared "Unknown" player row: one fake id collecting a rating
--    from every stranger in the club is the thing the doubles plan forbids.
--
--    The distinct-players check needs no change: a comparison with null is
--    null, which a CHECK treats as passing, so two empty seats do not count
--    as "the same person twice".
--
-- 2. THE SCORE MAY BE EMPTY.
--    sets may now be [] and then the winner is taken as entered -- the same
--    rule singles has always had, where the score is optional and the winner
--    is the input. With sets present, the trigger still refuses a winner that
--    contradicts them, exactly as before.

alter table public.doubles_matches alter column team_a_p2 drop not null;
alter table public.doubles_matches alter column team_b_p2 drop not null;

alter table public.doubles_matches drop constraint if exists doubles_matches_sets_shape;
alter table public.doubles_matches add constraint doubles_matches_sets_shape check (
  jsonb_typeof(sets) = 'array'
);

create or replace function public.doubles_match_is_sane()
returns trigger
language plpgsql
as $$
declare
  wrong_league int;
  named int;
  found int;
  sets_a int;
  sets_b int;
  implied text;
begin
  select count(*) into wrong_league
  from public.players p
  where p.id in (new.team_a_p1, new.team_a_p2, new.team_b_p1, new.team_b_p2)
    and p.league_id is distinct from new.league_id;

  if wrong_league > 0 then
    raise exception 'All players must belong to league %', new.league_id;
  end if;

  -- Every NAMED seat must be a real player. Was "exactly four", which an
  -- empty seat would now fail.
  named := (new.team_a_p1 is not null)::int + (new.team_a_p2 is not null)::int
         + (new.team_b_p1 is not null)::int + (new.team_b_p2 is not null)::int;
  select count(*) into found from public.players p
  where p.id in (new.team_a_p1, new.team_a_p2, new.team_b_p1, new.team_b_p2);
  if found <> named then
    raise exception 'Every named player must exist';
  end if;

  -- No score: the winner is the input, as in singles. Nothing to check it
  -- against, so nothing is refused.
  if jsonb_array_length(new.sets) > 0 then
    select
      count(*) filter (where (s->>'a')::int > (s->>'b')::int),
      count(*) filter (where (s->>'b')::int > (s->>'a')::int)
    into sets_a, sets_b
    from jsonb_array_elements(new.sets) s;

    implied := case
      when sets_a > sets_b then 'A'
      when sets_b > sets_a then 'B'
      else 'draw'
    end;

    if implied <> new.winner then
      raise exception 'Winner % does not match the sets (% – %)', new.winner, sets_a, sets_b;
    end if;
  end if;

  new.updated_at := now();
  return new;
end
$$;

revoke all on function public.doubles_match_is_sane() from public, anon;

-- ---------------------------------------------------------------------------
-- Verification — one statement, proving what THIS file did.
-- ---------------------------------------------------------------------------
select
  (select is_nullable from information_schema.columns
    where table_schema = 'public' and table_name = 'doubles_matches' and column_name = 'team_a_p2') as team_a_p2_nullable,
  (select is_nullable from information_schema.columns
    where table_schema = 'public' and table_name = 'doubles_matches' and column_name = 'team_b_p2') as team_b_p2_nullable,
  (select pg_get_constraintdef(oid) from pg_constraint
    where conname = 'doubles_matches_sets_shape')                                                 as sets_rule,
  (select position('jsonb_array_length(new.sets) > 0' in prosrc) > 0 from pg_proc
    where proname = 'doubles_match_is_sane')                                                      as trigger_allows_no_score;

-- Expect: YES, YES, a sets_rule with no "jsonb_array_length", true.
--
-- THEN RUN supabase/fix_function_grants.sql. create or replace counts as a
-- new function, so it is open to anon again until that runs.
