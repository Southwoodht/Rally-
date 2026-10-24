-- Southwood — a player's UTR, shown beside their stars (2026-10-24)
--
-- Back up first (backup_everything.sql). Then run fix_function_grants.sql.
-- Needs schema_starting_record_organisers.sql, already run. Adds one column
-- and touches no existing row. Safe to re-run.
--
-- Sam: "my stars are better but can't beat them, join them". A player who
-- has a UTR (Universal Tennis Rating, 1 to 16.5) can give it at sign-up; the
-- app turns it into their stars (core/utr.ts) and shows "UTR 3.2" beside
-- them. Nobody needs one.
--
-- It follows the level rule exactly, because it IS a level by another name:
--
--   * Owners and organisers may set it for anybody in the club, signed up or
--     not, through set_player_utr().
--   * A player may set their OWN once, while they have none: onboarding.
--   * Anyone else is refused with a sentence.
--   * A new row added by a non-organiser for somebody else arrives without it.
--
-- guard_player_level() is replaced again, not added to: one trigger, one
-- place the rule lives. The level and starting-record halves are unchanged.

alter table public.players add column if not exists utr numeric(4,2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'players_utr_range') then
    alter table public.players add constraint players_utr_range check (utr is null or (utr >= 1 and utr <= 16.5));
  end if;
end;
$$;

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
      new.utr := null;
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

  if new.utr is distinct from old.utr
     and not (old.auth_id = auth.uid() and old.utr is null) then
    raise exception 'Only an organiser can change a UTR.';
  end if;

  return new;
end;
$$;

-- The trigger itself (players_guard_level) already points at this function.

create or replace function public.set_player_utr(p_player_id text, p_utr numeric)
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
    raise exception 'Only an organiser of this club can set a UTR.';
  end if;
  update public.players set utr = p_utr where id = p_player_id;
end;
$$;

revoke all on function public.set_player_utr(text, numeric) from public, anon;
grant execute on function public.set_player_utr(text, numeric) to authenticated;
revoke all on function public.guard_player_level() from public, anon;

notify pgrst, 'reload schema';

-- Proves what this file did. Expect: numeric, true, true, false.
select
  (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'players' and column_name = 'utr') as utr_column,
  (select position('new.utr' in prosrc) > 0 from pg_proc where proname = 'guard_player_level') as guard_covers_utr,
  exists (select 1 from pg_proc where proname = 'set_player_utr') as organiser_function,
  has_function_privilege('anon', 'public.set_player_utr(text, numeric)', 'execute') as anon_may_call;
