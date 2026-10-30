-- Southwood — organisers rename a member (2026-10-30)
--
-- Adds one function; touches no row until an organiser uses it. Safe to
-- re-run. Its own revoke closes it to signed-out callers; run
-- fix_function_grants.sql afterwards anyway, as after every migration.
--
-- Sam: owners and editors can edit any member's display name — "fix
-- Cheesedog4000… to Charlie Easey". set_player_name (schema_moderation.sql)
-- already renames the PLAYER in the club's list, but a member's ACCOUNT name
-- is what the members list, search, messages and the Global table show, and
-- only the person themselves could change it.
--
-- set_member_name sets both in one go: the account's display name, and the
-- player row(s) they hold in THIS club (first word → name, the rest → last).
--
-- Allowed only for an owner or editor of the club, only for somebody who is
-- a member of that same club, and an editor cannot rename an owner. The app
-- checks the name against the offensive-words filter (core/nameFilter.ts)
-- before calling; this checks length and that it isn't blank.

create or replace function public.set_member_name(p_league_id uuid, p_user_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_target_role text;
  v_my_role text;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only owners and editors can rename members.';
  end if;
  select role into v_target_role from public.league_members where league_id = p_league_id and user_id = p_user_id;
  if v_target_role is null then
    raise exception 'They are not a member of this club.';
  end if;
  select role into v_my_role from public.league_members where league_id = p_league_id and user_id = auth.uid();
  if v_target_role = 'owner' and v_my_role <> 'owner' then
    raise exception 'Only an owner can rename an owner.';
  end if;
  if v_name = '' or length(v_name) > 60 then
    raise exception 'A name between 1 and 60 characters, please.';
  end if;

  update public.profiles set display_name = v_name where id = p_user_id;
  update public.players
     set name = split_part(v_name, ' ', 1),
         last = nullif(btrim(substr(v_name, length(split_part(v_name, ' ', 1)) + 1)), '')
   where league_id = p_league_id and auth_id = p_user_id;
end;
$$;

revoke all on function public.set_member_name(uuid, uuid, text) from public, anon;
grant execute on function public.set_member_name(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';

-- Proves it exists and is closed to signed-out callers. Expect: 1, false.
select
  (select count(*) from pg_proc where proname = 'set_member_name') as functions,
  has_function_privilege('anon', 'public.set_member_name(uuid, uuid, text)', 'execute') as anon_may_call;
