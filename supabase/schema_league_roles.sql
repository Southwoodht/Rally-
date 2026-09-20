-- Rally — an owner can make somebody an editor, and hand the league on
--
-- NOT RUN BY A CODING SESSION. Sam runs this.
--
-- WHY
--
-- A role is written in exactly two places today and never again: createLeague
-- writes "owner" for whoever creates the league, joinLeague writes "member"
-- for everyone else. There is no promote, no demote, no transfer, and no UI.
-- Sam asked "surely I get power who I give editor to" and the answer was no —
-- not hidden from him, not built.
--
-- That matters more than it sounds, because owner-or-editor gates editing
-- other people's matches, posting announcements, generating and clearing
-- fixtures, recording trophies, and setting a level estimate. A league whose
-- owner row is wrong has all of that closed to everybody in it, permanently,
-- with no way back short of SQL.
--
-- WHY A FUNCTION AND NOT A POLICY
--
-- league_members has no UPDATE policy at all, so no role can be changed by
-- any route. Adding one would have to express "an owner of THIS league may
-- change THIS row, except when it would leave the league ownerless" — and the
-- last clause is not a row-level condition, it is a statement about the table
-- after the write. RLS cannot say it. A function can, and can also say why it
-- refused in words a person can read.

create or replace function public.set_league_role(
  p_league_id uuid,
  p_user_id   uuid,
  p_role      text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owners int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;

  if p_role not in ('owner', 'editor', 'member') then
    raise exception 'A role is owner, editor or member.';
  end if;

  -- Only an owner. An editor can run a league but cannot decide who else
  -- gets to, which is the whole difference between the two.
  if not exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Only the league owner can change roles.';
  end if;

  if not exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = p_user_id
  ) then
    raise exception 'That person is not in this league.';
  end if;

  -- The guard that cannot be a policy: never leave a league with no owner.
  -- Checked before the write rather than after, because a league that has
  -- locked everybody out of its own settings cannot be repaired from inside
  -- the app by anybody.
  if p_role <> 'owner' then
    select count(*) into v_owners
      from public.league_members
     where league_id = p_league_id and role = 'owner';
    if v_owners <= 1 and exists (
      select 1 from public.league_members
      where league_id = p_league_id and user_id = p_user_id and role = 'owner'
    ) then
      raise exception 'A league needs an owner. Make somebody else an owner first, then step down.';
    end if;
  end if;

  update public.league_members
     set role = p_role
   where league_id = p_league_id and user_id = p_user_id;
end;
$$;

-- `from public, anon` and not `from public` alone. Supabase grants execute on
-- a new function to anon DIRECTLY, so revoking PUBLIC succeeds and leaves anon
-- exactly where it was — which is how six functions sat open for a fortnight
-- with a correct-looking revoke in every file. See §6.
revoke all on function public.set_league_role(uuid, uuid, text) from public, anon;
grant execute on function public.set_league_role(uuid, uuid, text) to authenticated;

-- Expect: authenticated true, anon false.
select f.proname                                 as created,
       pg_get_function_identity_arguments(f.oid) as takes,
       has_function_privilege('authenticated', f.oid, 'execute') as authenticated_may_call,
       has_function_privilege('anon', f.oid, 'execute')          as anon_may_call
  from pg_proc f join pg_namespace n on n.oid = f.pronamespace
 where n.nspname = 'public' and f.proname = 'set_league_role';
