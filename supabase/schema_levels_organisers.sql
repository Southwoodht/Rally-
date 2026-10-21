-- Southwood — levels are set by organisers (winter pilot, brief item 2)
--
-- Back up first (backup_everything.sql). Then run fix_function_grants.sql.
-- Needs schema_security_winter_a.sql (is_league_staff), already run.
-- Rules, a function and two new tables. Touches no existing row. Safe to re-run.
--
-- WHAT CHANGES, in Sam's words (2026-10-21): "new players pick a level once,
-- then only organisers change it. For the pilot, James reviews everyone's
-- level." And: "locking levels must also cover players who haven't signed up".
--
--   * A player's level and level history may be changed by the club's owner
--     or organisers — for anybody, signed up or not — through
--     set_player_level(), which writes the real columns. (The players UPDATE
--     policy only ever let an organiser touch rows nobody had claimed, which
--     is why the "estimate" columns were invented; this is the proper door.)
--   * A player may set their OWN level once, while they have none: the first
--     pick at sign-up. After that, never.
--   * Anyone else trying — including a player changing an unclaimed shell's
--     level, which the old rule allowed — is refused with a sentence.
--   * A new player row added by a non-organiser cannot arrive carrying a
--     level for somebody else: it is created with none.
--   * Every change of level is written to level_changes, by a trigger, with
--     who and when — the "logged with the date" half of the brief. The app
--     also writes the dated period into level_history (withLevelChange in
--     core/levels.ts) so the ratings grade by it.
--   * level_requests: a player asks for a change; organisers approve or
--     decline. One pending request per player at a time.
--
-- League-less (Friendlies) rows are left to their own rules: there is no
-- organiser to ask.
--
-- The SQL editor (no signed-in user) is let through, so Sam can still repair
-- a level by hand.

-- -------------------------------------------------------------------- log

create table if not exists public.level_changes (
  id          uuid primary key default gen_random_uuid(),
  player_id   text not null references public.players(id) on delete cascade,
  league_id   uuid references public.leagues(id) on delete cascade,
  old_level   jsonb,
  new_level   jsonb,
  changed_by  uuid,
  changed_at  timestamptz not null default now()
);
create index if not exists level_changes_player_idx on public.level_changes (player_id, changed_at desc);

alter table public.level_changes enable row level security;

drop policy if exists "organisers and the player read level changes" on public.level_changes;
create policy "organisers and the player read level changes"
  on public.level_changes for select
  using (
    public.is_league_staff(league_id)
    or exists (select 1 from public.players p where p.id = player_id and p.auth_id = auth.uid())
  );
-- No insert/update/delete policy: only the trigger below writes it.

-- --------------------------------------------------------------- requests

create table if not exists public.level_requests (
  id            uuid primary key default gen_random_uuid(),
  league_id     uuid not null references public.leagues(id) on delete cascade,
  player_id     text not null references public.players(id) on delete cascade,
  requested_by  uuid not null default auth.uid(),
  level         jsonb not null,
  note          text,
  status        text not null default 'pending',
  decided_by    uuid,
  decided_at    timestamptz,
  created_at    timestamptz not null default now(),
  constraint level_requests_status check (status in ('pending', 'approved', 'declined'))
);
create index if not exists level_requests_league_idx on public.level_requests (league_id, status);
create unique index if not exists level_requests_one_pending
  on public.level_requests (player_id) where status = 'pending';

alter table public.level_requests enable row level security;

drop policy if exists "ask for your own level change" on public.level_requests;
create policy "ask for your own level change"
  on public.level_requests for insert
  with check (
    requested_by = auth.uid()
    and status = 'pending' and decided_by is null
    and exists (select 1 from public.players p
                 where p.id = player_id and p.auth_id = auth.uid() and p.league_id = level_requests.league_id)
  );

drop policy if exists "read your own requests, organisers read all" on public.level_requests;
create policy "read your own requests, organisers read all"
  on public.level_requests for select
  using (requested_by = auth.uid() or public.is_league_staff(league_id));

drop policy if exists "organisers decide requests" on public.level_requests;
create policy "organisers decide requests"
  on public.level_requests for update
  using (public.is_league_staff(league_id))
  with check (public.is_league_staff(league_id));

drop policy if exists "withdraw your own pending request" on public.level_requests;
create policy "withdraw your own pending request"
  on public.level_requests for delete
  using (requested_by = auth.uid() and status = 'pending');

-- ------------------------------------------------------------------ guard

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
    -- Somebody else's new row arrives with no level unless an organiser is
    -- adding it. Stripped rather than refused, so "add a player" keeps
    -- working for everybody; the level is then an organiser's to set.
    if new.league_id is not null
       and (new.level is not null or new.level_history is not null)
       and new.auth_id is distinct from auth.uid()
       and not public.is_league_staff(new.league_id) then
      new.level := null;
      new.level_history := null;
    end if;
    return new;
  end if;

  if new.level is not distinct from old.level
     and new.level_history is not distinct from old.level_history then
    return new;
  end if;
  if new.league_id is null then
    return new;                                   -- Friendlies: no organisers
  end if;
  if public.is_league_staff(new.league_id) then
    return new;
  end if;
  if old.auth_id = auth.uid() and old.level is null then
    return new;                                   -- your first pick
  end if;
  raise exception 'Only an organiser can change a level. You can ask for a change from your profile.';
end;
$$;

drop trigger if exists players_guard_level on public.players;
create trigger players_guard_level
  before insert or update on public.players
  for each row execute function public.guard_player_level();

-- The log. Security definer, because level_changes has no insert policy and
-- must not have one: nothing but this trigger may write it.
create or replace function public.log_player_level()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.level is distinct from old.level then
    insert into public.level_changes (player_id, league_id, old_level, new_level, changed_by)
    values (new.id, new.league_id, old.level, new.level, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists players_log_level on public.players;
create trigger players_log_level
  after update on public.players
  for each row execute function public.log_player_level();

-- ---------------------------------------------------------- the one door

-- An organiser setting anybody's level and timeline in their club — signed
-- up or not. The app works out the timeline (withLevelChange) so the dated
-- period and the level always arrive together.
create or replace function public.set_player_level(p_player_id text, p_level jsonb, p_history jsonb)
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
    raise exception 'Only an organiser of this club can set a level.';
  end if;
  update public.players
     set level = p_level, level_history = p_history
   where id = p_player_id;
end;
$$;

revoke all on function public.set_player_level(text, jsonb, jsonb) from public, anon;
grant execute on function public.set_player_level(text, jsonb, jsonb) to authenticated;
revoke all on function public.log_player_level() from public, anon;
revoke all on function public.guard_player_level() from public, anon;

notify pgrst, 'reload schema';

-- Proves what this file did. Expect: true, true, 2, true, false.
select
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'level_requests') as requests_table,
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'level_changes') as changes_log,
  (select count(*) from pg_trigger where tgname in ('players_guard_level', 'players_log_level')) as triggers,
  exists (select 1 from pg_proc where proname = 'set_player_level') as organiser_function,
  has_function_privilege('anon', 'public.set_player_level(text, jsonb, jsonb)', 'execute') as anon_may_call;
