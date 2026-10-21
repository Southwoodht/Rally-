-- Southwood — starting rating and record are set by organisers too (winter pilot)
--
-- Back up first (backup_everything.sql). Then run fix_function_grants.sql.
-- Needs schema_levels_organisers.sql, already run. Touches no existing row.
-- Safe to re-run.
--
-- Sam, 2026-10-21: "Starting rating lock: yes, organisers only. Otherwise
-- it's the same loophole as levels, just through a different door."
--
-- initial_elo and initial_record are the rating and the W-D-L a player
-- carried in from before the app. Both count in the ratings, and until now
-- anybody could rewrite their own at any time from My profile. The rule is
-- now the level rule, exactly:
--
--   * Owners and organisers may set them for anybody in the club, signed up
--     or not, through set_player_start().
--   * A player may set their OWN once, while they have none: onboarding.
--   * Anyone else is refused with a sentence.
--   * A new row added by a non-organiser for somebody else arrives without
--     them.
--
-- Friendlies (no league) keep their own rules: there is no organiser.
-- The SQL editor (no signed-in user) is let through.
--
-- guard_player_level() is replaced, not added to: one trigger, one place the
-- rule lives. The level half keeps exactly the rule it had.

create or replace function public.guard_player_level()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.league_id is not null
       and new.auth_id is distinct from auth.uid()
       and not public.is_league_staff(new.league_id) then
      new.level := null;
      new.level_history := null;
      new.initial_elo := null;
      new.initial_record := null;
    end if;
    return new;
  end if;

  if new.league_id is null or public.is_league_staff(new.league_id) then
    return new;
  end if;

  if (new.level is distinct from old.level or new.level_history is distinct from old.level_history)
     and not (old.auth_id = auth.uid() and old.level is null) then
    raise exception 'Only an organiser can change a level. You can ask for a change from your profile.';
  end if;

  if (new.initial_elo is distinct from old.initial_elo or new.initial_record is distinct from old.initial_record)
     and not (old.auth_id = auth.uid() and old.initial_elo is null and old.initial_record is null) then
    raise exception 'Only an organiser can change a starting rating or record.';
  end if;

  return new;
end;
$$;

-- The trigger itself (players_guard_level) already points at this function.

create or replace function public.set_player_start(p_player_id text, p_elo numeric, p_record jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
begin
  select league_id into lid from public.players where id = p_player_id;
  if lid is null or not public.is_league_staff(lid) then
    raise exception 'Only an organiser of this club can set a starting rating or record.';
  end if;
  update public.players
     set initial_elo = p_elo, initial_record = p_record
   where id = p_player_id;
end;
$$;

revoke all on function public.set_player_start(text, numeric, jsonb) from public, anon;
grant execute on function public.set_player_start(text, numeric, jsonb) to authenticated;
revoke all on function public.guard_player_level() from public, anon;

notify pgrst, 'reload schema';

-- Proves what this file did. Expect: true, true, false.
select
  (select position('initial_record' in prosrc) > 0 from pg_proc where proname = 'guard_player_level') as guard_covers_start,
  exists (select 1 from pg_proc where proname = 'set_player_start') as organiser_function,
  has_function_privilege('anon', 'public.set_player_start(text, numeric, jsonb)', 'execute') as anon_may_call;
