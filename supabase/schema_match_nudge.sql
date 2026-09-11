-- Rally — the nudge
--
-- Two columns and one function. Nothing is added, deleted or rewritten, and
-- no existing policy changes.
--
-- WHY A COLUMN AND NOT A MESSAGE
--
-- Nudging delivers through the existing message system, but the message
-- cannot be the record: a message can be deleted, and then the app has
-- forgotten something it needs to know. The timestamp lives on the match.
--
-- WHY A FUNCTION AND NOT A POLICY
--
-- The limit is one nudge per pending result per 24 hours, and it has to be
-- enforced server-side — a disabled button is a suggestion, it stops the
-- person who accepts it and nobody else.
--
-- But it cannot be an RLS policy. Permissive policies for the same command
-- are OR'd together, so an extra UPDATE policy on matches would *widen*
-- access rather than narrow it, and would hand the reporter the right to
-- rewrite any column on a pending match. A security-definer function is the
-- pattern this app already uses for rules that cross a boundary —
-- start_thread(), is_league_member(), level_val() — and it is the right one
-- here.

alter table public.matches
  add column if not exists nudged_at timestamptz,
  add column if not exists nudged_by uuid references auth.users(id);

create or replace function public.nudge_match(p_match_id text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last timestamptz;
  v_status text;
  v_is_reporter boolean;
begin
  select m.nudged_at, m.status,
         exists (select 1 from public.players pl
                 where pl.id = m.reported_by and pl.auth_id = auth.uid())
    into v_last, v_status, v_is_reporter
  from public.matches m
  where m.id = p_match_id;

  if not found then
    raise exception 'No such match.';
  end if;

  -- Only the person who reported it. A result someone else logged is waiting
  -- on YOU, so there is nobody for you to chase.
  if not v_is_reporter then
    raise exception 'Only whoever logged this result can nudge about it.';
  end if;

  if v_status is distinct from 'pending' then
    raise exception 'That result is already settled.';
  end if;

  if v_last is not null and v_last > now() - interval '24 hours' then
    raise exception 'Already nudged in the last 24 hours.';
  end if;

  update public.matches
     set nudged_at = now(), nudged_by = auth.uid()
   where id = p_match_id;

  return now();
end;
$$;

revoke all on function public.nudge_match(text) from public;
grant execute on function public.nudge_match(text) to authenticated;
