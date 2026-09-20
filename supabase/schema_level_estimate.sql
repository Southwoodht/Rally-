-- Rally — a league admin can fill in a level, but never overwrite a claim
--
-- NOT RUN BY A CODING SESSION. Sam runs this.
--
-- WHY
--
-- Half of Seacourt has no level and no level timeline, and the timeline is the
-- only thing that grades a match — so a win over a beginner scores full value
-- because the app cannot tell he is a beginner. The fix on paper is "everyone
-- re-picks their level". In practice people are being nagged to do admin for
-- an app they play tennis with, and they are not doing it.
--
-- The obvious answer — let the league owner edit their row — is the wrong one,
-- and Sam is the one who spotted why. At any scale above one friendly club it
-- reads: Bob starts a league, adds Zaach, sets Zaach to Amateur out of spite,
-- and Zaach's results are re-valued by somebody he has never agreed to be
-- judged by. Blocking and appeals are then features invented to contain a
-- design that should not have allowed it.
--
-- So an admin does not set a level. They set an **estimate**, in its own
-- columns, and four properties hold by construction rather than by good
-- behaviour:
--
--   1. It cannot overwrite a claim. Different column; `level` is untouched by
--      this function, and nothing else may write these columns.
--   2. The person always wins. The app reads their own level and their own
--      timeline first and only falls back to the estimate when those are
--      empty. One tap and the estimate is inert, permanently, with nobody to
--      appeal to and no admin to block.
--   3. It stays in that league. players rows are per-league, so an estimate
--      lives on that league's row and weights that league's matches. It never
--      reaches another league's table.
--   4. It never reaches the global table. global_standings() reads
--      players.level, which this does not write — so a spiteful estimate
--      cannot move somebody's global standing or the level on their badge.
--      That is deliberate and it is the whole of property 4: the global table
--      ranks self-claims and evidence, never somebody else's opinion of you.
--
-- The UI labels it as the admin's estimate and never as the person's claim.
--
-- Nothing is rewritten. Four new columns, all null on every existing row, and
-- one function.

-- 1. The columns ---------------------------------------------------------
--
-- Mirrors of `level` and `level_history`, same jsonb shapes, plus who set it
-- and when. Stored rather than derived so a profile can say "set by your
-- league admin" and mean it.
alter table public.players add column if not exists level_estimate         jsonb;
alter table public.players add column if not exists level_estimate_history jsonb;
alter table public.players add column if not exists level_estimate_by      uuid references auth.users(id) on delete set null;
alter table public.players add column if not exists level_estimate_at      timestamptz;

-- 2. Writing one --------------------------------------------------------
--
-- A function rather than a widened UPDATE policy, because RLS cannot limit
-- which columns a statement touches. "Let owners edit their members' rows"
-- would hand them names, avatars, nicknames and auth_id along with the level,
-- and rewriting somebody's identity from an admin screen is the Charlie
-- incident with a nicer UI on it. This writes four columns and can write no
-- others.
--
-- Security definer, so it bypasses the row policy it is deliberately not
-- widening — and therefore checks the caller itself, first thing.
create or replace function public.set_player_level_estimate(
  p_player_id text,
  p_level     jsonb,
  p_history   jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league uuid;
  v_entry  jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;

  select league_id into v_league from public.players where id = p_player_id;
  if not found then
    raise exception 'No such player.';
  end if;

  -- A league-less player has no admin by definition: there is no league to be
  -- an owner of. Their own row, their own claim.
  if v_league is null then
    raise exception 'That player is not in a league, so nobody can estimate for them.';
  end if;

  if not exists (
    select 1 from public.league_members lm
    where lm.league_id = v_league
      and lm.user_id = auth.uid()
      and lm.role in ('owner', 'editor')
  ) then
    raise exception 'Only a league owner or editor can set a level estimate.';
  end if;

  -- Validate rather than store rubbish. level_val() returns null for a
  -- category or sub it does not recognise, and a null level is excluded from
  -- the quality filter entirely — so an unrecognised estimate would be stored
  -- happily and then silently do nothing, which is the failure mode this
  -- whole change exists to stop.
  if p_level is not null and public.level_val(p_level) is null then
    raise exception 'That is not a level this app knows.';
  end if;

  if p_history is not null then
    if jsonb_typeof(p_history) <> 'array' then
      raise exception 'A level timeline must be a list.';
    end if;
    for v_entry in select * from jsonb_array_elements(p_history) loop
      if public.level_val(v_entry) is null then
        raise exception 'That timeline has an entry this app does not recognise.';
      end if;
      if not jsonb_exists(v_entry, 'from') then
        raise exception 'Every timeline entry needs an effective-from date.';
      end if;
    end loop;
  end if;

  update public.players
     set level_estimate         = p_level,
         level_estimate_history = p_history,
         level_estimate_by      = auth.uid(),
         level_estimate_at      = now()
   where id = p_player_id;
end;
$$;

grant execute on function public.set_player_level_estimate(text, jsonb, jsonb) to authenticated;

-- 3. Reading one ---------------------------------------------------------
--
-- Nothing to do. The columns come back with the row under the existing select
-- policy, and the app decides precedence: own level, then estimate, then
-- nothing. Precedence lives in the app on purpose — it is a judgement about
-- what a number means, and tuning it should never need a migration.
