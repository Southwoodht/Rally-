-- Southwood — seasons, and competitions that live inside them (winter pilot)
--
-- Back up first (backup_everything.sql). Then run fix_function_grants.sql.
-- Needs schema_security_winter_a.sql (for is_league_staff), already run.
-- Safe to re-run.
--
-- ADDITIVE, plus ONE COPY, flagged: each club's current season is copied out
-- of its settings blob into the new table (Seacourt's "Test League",
-- 1 Jan – 31 Dec 2026). The blob itself is left exactly as it is.
--
-- WHY (SOUTHWOOD_WINTER_BRIEF.md item 1). A season was `{ name, start, end }`
-- inside the club's settings blob. Ending one deleted it, so a finished
-- season left no record, no podium and nothing to look back on; and
-- competitions had no dates and no tie to any season. Now:
--
--   seasons            one row per season; only one ACTIVE per club, which
--                      the unique index enforces rather than the app hoping.
--   competitions       may belong to a season (season_id) and take its dates.
--   fixtures           a competition tie gets a play-by day, and an organiser
--   doubles_fixtures   can record a walkover or void it.
--
-- Who may do what:
--   * any member reads seasons; owner and organisers create, edit, end them;
--   * CHANGING a play-by day, a walkover, a void, or which competition/round
--     a fixture belongs to is organiser-only — enforced by a trigger, because the
--     fixtures UPDATE policy lets any member update (they must, to record the
--     result of their own match) and RLS cannot narrow it column by column;
--   * a competition fixture can only be DELETED by an organiser, so a
--     player's "cancel" cannot erase a tie from the draw.
--   The trigger lets the SQL editor through (no signed-in user there), so
--   Sam can still repair a row by hand.
--
-- Closing a season needs no organiser: close_season_if_due() ends it once
-- its last day has passed in the UK, whoever opens the app first, and does
-- nothing on any other day. The app reads "final standings" as the matches
-- dated in the season and logged before `ended_at`, so nothing added later
-- can move them.

-- ------------------------------------------------------------------ seasons

create table if not exists public.seasons (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid not null references public.leagues(id) on delete cascade,
  name        text not null,
  starts_on   date not null,
  ends_on     date,
  status      text not null default 'active',
  ended_at    timestamptz,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  constraint seasons_name   check (length(trim(name)) > 0),
  constraint seasons_status check (status in ('active', 'ended')),
  constraint seasons_dates  check (ends_on is null or ends_on >= starts_on)
);

create index if not exists seasons_league_idx on public.seasons (league_id);
create unique index if not exists seasons_one_active
  on public.seasons (league_id) where status = 'active';

alter table public.seasons enable row level security;

drop policy if exists "members read their club's seasons" on public.seasons;
create policy "members read their club's seasons"
  on public.seasons for select
  using (public.is_league_member(league_id));

drop policy if exists "organisers run seasons" on public.seasons;
create policy "organisers run seasons"
  on public.seasons for all
  using (public.is_league_staff(league_id))
  with check (public.is_league_staff(league_id));

-- Ends a season whose last UK day has passed. Any member may ask; it does
-- nothing unless the date says so. Returns true only to the one caller who
-- actually closed it, so exactly one app posts the winners to the feed.
create or replace function public.close_season_if_due(p_season uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.seasons
     set status = 'ended', ended_at = now()
   where id = p_season
     and status = 'active'
     and ends_on is not null
     and ends_on < (now() at time zone 'Europe/London')::date
     and public.is_league_member(league_id);
  return found;
end;
$$;

revoke all on function public.close_season_if_due(uuid) from public, anon;
grant execute on function public.close_season_if_due(uuid) to authenticated;

-- ------------------------------------------------- competitions → seasons

alter table public.doubles_competitions
  add column if not exists season_id uuid references public.seasons(id) on delete set null;

-- ----------------------------------------------------------- fixture dates

alter table public.fixtures add column if not exists play_by date;
alter table public.fixtures add column if not exists outcome text;
alter table public.fixtures drop constraint if exists fixtures_outcome;
alter table public.fixtures add constraint fixtures_outcome
  check (outcome is null or outcome in ('walkover_p1', 'walkover_p2', 'void'));

alter table public.doubles_fixtures add column if not exists play_by date;
alter table public.doubles_fixtures add column if not exists outcome text;
alter table public.doubles_fixtures drop constraint if exists doubles_fixtures_outcome;
alter table public.doubles_fixtures add constraint doubles_fixtures_outcome
  check (outcome is null or outcome in ('walkover_a', 'walkover_b', 'void'));

-- Organiser-only fields on a fixture. One function for both tables: they
-- share league_id, competition_id, round, play_by and outcome.
create or replace function public.guard_competition_fixture()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  lid uuid;
begin
  -- The SQL editor, and Postgres itself on a cascade from a deleted club.
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if old.competition_id is not null and not public.is_league_staff(old.league_id) then
      raise exception 'Only an organiser can remove a competition match.';
    end if;
    return old;
  end if;

  lid := new.league_id;
  if tg_op = 'INSERT' then
    -- Any member may DRAW a tie the bracket already implies (the next
    -- knockout round, with the deadline the app works out for it) — that has
    -- always been open, and the unique index makes a double draw harmless.
    -- A walkover or void on a brand-new row is never a draw; organisers only.
    if new.outcome is not null and not public.is_league_staff(lid) then
      raise exception 'Only an organiser can record a walkover or void.';
    end if;
    return new;
  end if;

  -- UPDATE
  if (new.play_by is distinct from old.play_by
      or new.outcome is distinct from old.outcome
      or new.competition_id is distinct from old.competition_id
      or new.round is distinct from old.round)
     and not public.is_league_staff(coalesce(old.league_id, lid)) then
    raise exception 'Only an organiser can change a deadline, walkover or void.';
  end if;
  return new;
end;
$$;

drop trigger if exists fixtures_guard_competition on public.fixtures;
create trigger fixtures_guard_competition
  before insert or update or delete on public.fixtures
  for each row execute function public.guard_competition_fixture();

drop trigger if exists doubles_fixtures_guard_competition on public.doubles_fixtures;
create trigger doubles_fixtures_guard_competition
  before insert or update or delete on public.doubles_fixtures
  for each row execute function public.guard_competition_fixture();

-- ------------------------------------------- copy the current season across
--
-- THE ONE DATA WRITE. For each club whose settings blob holds a season and
-- which has no season row yet: one row with the same name and dates, active
-- unless its end date has already passed. The blob is not touched.

insert into public.seasons (league_id, name, starts_on, ends_on, status, ended_at, created_by)
select lid,
       coalesce(nullif(trim(g->'season'->>'name'), ''), 'Season'),
       (to_timestamp((g->'season'->>'start')::double precision / 1000) at time zone 'Europe/London')::date,
       case when jsonb_typeof(g->'season'->'end') = 'number'
            then (to_timestamp((g->'season'->>'end')::double precision / 1000) at time zone 'Europe/London')::date end,
       case when jsonb_typeof(g->'season'->'end') = 'number'
             and (to_timestamp((g->'season'->>'end')::double precision / 1000) at time zone 'Europe/London')::date
                 < (now() at time zone 'Europe/London')::date
            then 'ended' else 'active' end,
       case when jsonb_typeof(g->'season'->'end') = 'number'
             and (to_timestamp((g->'season'->>'end')::double precision / 1000) at time zone 'Europe/London')::date
                 < (now() at time zone 'Europe/London')::date
            then now() end,
       null
  from (
    select public.shared_storage_league_id(ss.key) as lid, g
      from public.shared_storage ss
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(ss.value::jsonb) = 'array' then ss.value::jsonb else '[]'::jsonb end
      ) g
     where ss.key ~ '^groups_'
       and public.shared_storage_league_id(ss.key) is not null
  ) src
 where jsonb_typeof(g->'season') = 'object'
   and jsonb_typeof(g->'season'->'start') = 'number'
   and (g->>'id') = lid::text
   and exists (select 1 from public.leagues l where l.id = lid)
   and not exists (select 1 from public.seasons s where s.league_id = lid);

notify pgrst, 'reload schema';

-- Proves what this file did. Expect: true, the number of clubs with a season
-- (Seacourt's at least), true, true, 2.
select
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'seasons') as seasons_table,
  (select count(*) from public.seasons) as seasons_copied,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'fixtures' and column_name = 'play_by') as fixtures_have_deadlines,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'doubles_competitions' and column_name = 'season_id') as competitions_have_seasons,
  (select count(*) from pg_trigger where tgname in ('fixtures_guard_competition', 'doubles_fixtures_guard_competition')) as guards;
