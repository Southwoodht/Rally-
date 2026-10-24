-- Moderation (Sam, 2026-10-24). Two doors, both additive — no data is touched
-- by running this file.
--
-- 1. set_player_name(): owners and editors rename any player in their club,
--    including somebody with an account. The players UPDATE policy lets a
--    member edit only unclaimed rows or their own, and that stays exactly as
--    it is; this is a narrow organiser door that can change the name and
--    surname and nothing else.
--
-- 2. remove_league_member(): an owner takes somebody out of the club. Their
--    membership row goes, so they can no longer read or write anything in it.
--    Their player row STAYS, with every result on it, so nobody else's rating
--    moves; it is marked not playing, which hides it from the Table (Sam's
--    choice). auth_id is left on the row, so if they are ever let back in
--    they land on their own record rather than an empty one. An owner cannot
--    be removed — make them an editor or member first — and nobody removes
--    themselves this way (Leave club does that).
--
-- Run fix_function_grants.sql afterwards, as after every migration.

create or replace function public.set_player_name(p_player_id text, p_name text, p_last text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
begin
  select league_id into lid from public.players where id = p_player_id;
  if lid is null then
    raise exception 'That player is not in a club.';
  end if;
  if not public.is_league_staff(lid) then
    raise exception 'Only owners and editors can rename players.';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'A first name is needed.';
  end if;
  update public.players
     set name = trim(p_name),
         last = nullif(trim(coalesce(p_last, '')), '')
   where id = p_player_id;
end;
$$;

create or replace function public.remove_league_member(p_league_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  their_role text;
begin
  if not exists (
    select 1 from public.league_members
     where league_id = p_league_id and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Only an owner can remove somebody from the club.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'To leave the club yourself, use Leave club.';
  end if;
  select role into their_role from public.league_members
   where league_id = p_league_id and user_id = p_user_id;
  if their_role is null then
    raise exception 'They are not in this club.';
  end if;
  if their_role = 'owner' then
    raise exception 'Owners cannot be removed. Make them an editor or member first.';
  end if;

  update public.players set inactive = true
   where league_id = p_league_id and auth_id = p_user_id;
  delete from public.league_members
   where league_id = p_league_id and user_id = p_user_id;
end;
$$;

revoke all on function public.set_player_name(text, text, text) from public, anon;
grant execute on function public.set_player_name(text, text, text) to authenticated;
revoke all on function public.remove_league_member(uuid, uuid) from public, anon;
grant execute on function public.remove_league_member(uuid, uuid) to authenticated;

-- Proves both functions exist and are closed to signed-out callers.
-- Expect: 2, false, false.
select
  (select count(*) from pg_proc where proname in ('set_player_name', 'remove_league_member')) as functions,
  has_function_privilege('anon', 'public.set_player_name(text, text, text)', 'execute') as anon_rename,
  has_function_privilege('anon', 'public.remove_league_member(uuid, uuid)', 'execute') as anon_remove;
