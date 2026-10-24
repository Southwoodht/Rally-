-- Southwood — where a club is, so the app knows who is near whom (2026-10-24)
--
-- Then run fix_function_grants.sql. Adds three columns and touches no
-- existing row. Safe to re-run.
--
-- Sam: "when setting your local club it should recognise your location, then
-- the app can know who's near each other". Agreed with him: the position
-- belongs to the CLUB, never to a person. Players are "near" wherever their
-- clubs are; nobody's own whereabouts is stored, which matters with juniors
-- in clubs.
--
--   * leagues.lat / lng — rounded by the app to 2 decimals (about 1 km), so
--     a club's pin is a neighbourhood, not a front door.
--   * leagues.open_to_join — off unless an organiser switches it on. Only an
--     open club's code is handed out by clubs_near(); every other club is
--     listed as invite-only, so nobody can walk into a junior club by
--     standing near it.
--
-- Written through set_league_place() / set_league_open() because the
-- leagues UPDATE policy is the club's creator only, and these are for any
-- owner or organiser. Distances are plain great-circle maths; no extension.

alter table public.leagues add column if not exists lat double precision;
alter table public.leagues add column if not exists lng double precision;
alter table public.leagues add column if not exists open_to_join boolean not null default false;

-- Kilometres between two points (haversine).
create or replace function public.km_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

create or replace function public.set_league_place(p_league_id uuid, p_location text, p_lat double precision, p_lng double precision)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only an organiser of this club can change where it is.';
  end if;
  update public.leagues
     set location = nullif(btrim(coalesce(p_location, '')), ''),
         lat = case when p_lat is null then null else round(p_lat::numeric, 2)::double precision end,
         lng = case when p_lng is null then null else round(p_lng::numeric, 2)::double precision end
   where id = p_league_id;
end;
$$;

create or replace function public.set_league_open(p_league_id uuid, p_open boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only an organiser of this club can change who may join.';
  end if;
  update public.leagues set open_to_join = coalesce(p_open, false) where id = p_league_id;
end;
$$;

-- Clubs with a pin within p_km of a point, nearest first. The join code
-- comes back only for a club that is open to new players.
create or replace function public.clubs_near(p_lat double precision, p_lng double precision, p_km double precision default 40)
returns table (id uuid, name text, location text, km double precision, players integer, open_to_join boolean, join_code text, logo_url text, member boolean)
language sql
security definer
set search_path = public
as $$
  select l.id, l.name, l.location,
         round(public.km_between(p_lat, p_lng, l.lat, l.lng)::numeric, 1)::double precision as km,
         (select count(*)::int from public.players p where p.league_id = l.id and not coalesce(p.inactive, false)) as players,
         l.open_to_join,
         case when l.open_to_join then l.join_code else null end as join_code,
         l.logo_url,
         exists (select 1 from public.league_members m where m.league_id = l.id and m.user_id = auth.uid()) as member
    from public.leagues l
   where auth.uid() is not null
     and p_lat is not null and p_lng is not null
     and l.lat is not null and l.lng is not null
     and public.km_between(p_lat, p_lng, l.lat, l.lng) <= least(coalesce(p_km, 40), 200)
   order by 4
   limit 30;
$$;

-- For sorting a player search: how far each account's nearest club is from
-- a point, in whole kilometres. Accounts whose clubs have no pin are left out.
create or replace function public.players_near(p_ids uuid[], p_lat double precision, p_lng double precision)
returns table (auth_id uuid, km integer)
language sql
security definer
set search_path = public
as $$
  select p.auth_id, round(min(public.km_between(p_lat, p_lng, l.lat, l.lng)))::int as km
    from public.players p
    join public.leagues l on l.id = p.league_id
   where auth.uid() is not null
     and p_lat is not null and p_lng is not null
     and p.auth_id = any(p_ids)
     and l.lat is not null and l.lng is not null
   group by p.auth_id;
$$;

revoke all on function public.set_league_place(uuid, text, double precision, double precision) from public, anon;
revoke all on function public.set_league_open(uuid, boolean) from public, anon;
revoke all on function public.clubs_near(double precision, double precision, double precision) from public, anon;
revoke all on function public.players_near(uuid[], double precision, double precision) from public, anon;
grant execute on function public.set_league_place(uuid, text, double precision, double precision) to authenticated;
grant execute on function public.set_league_open(uuid, boolean) to authenticated;
grant execute on function public.clubs_near(double precision, double precision, double precision) to authenticated;
grant execute on function public.players_near(uuid[], double precision, double precision) to authenticated;

notify pgrst, 'reload schema';

-- Proves what this file did. Expect: 3, 4, false.
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'leagues' and column_name in ('lat', 'lng', 'open_to_join')) as new_columns,
  (select count(*) from pg_proc where proname in ('set_league_place', 'set_league_open', 'clubs_near', 'players_near')) as functions,
  has_function_privilege('anon', 'public.clubs_near(double precision, double precision, double precision)', 'execute') as anon_may_call;
