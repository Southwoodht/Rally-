-- Rally — public_league_snapshot(), minimal.
--
-- Same function as schema_public_league_snapshot.sql, with the explanation
-- stripped out. That file is the one to read; this is the one to paste, on
-- the theory that three pastes have now stopped before reaching the end of
-- a long file. Keep both: the reasoning matters and belongs somewhere.
--
-- It ends with a select, so you should get a ROW BACK. "Success. No rows
-- returned" means it did not finish.
create or replace function public.public_league_snapshot(p_auth_id uuid)
returns table (players jsonb, matches jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league uuid;
begin
  select m.league_id into v_league
    from public.matches m
    join public.players p on p.id in (m.p1, m.p2)
   where p.auth_id = p_auth_id
     and m.league_id is not null
     and m.status = 'confirmed'
   group by m.league_id
   order by count(*) desc
   limit 1;

  if v_league is null then
    return query select '[]'::jsonb, '[]'::jsonb;
    return;
  end if;

  return query
  select
    (select coalesce(jsonb_agg(to_jsonb(pl) order by pl.id), '[]'::jsonb)
       from public.players pl where pl.league_id = v_league),
    (select coalesce(jsonb_agg(to_jsonb(mt) order by mt.date), '[]'::jsonb)
       from public.matches mt
      where mt.league_id = v_league and mt.status = 'confirmed');
end;
$$;

revoke all on function public.public_league_snapshot(uuid) from public;
grant execute on function public.public_league_snapshot(uuid) to authenticated;

select f.proname as created,
       pg_get_function_identity_arguments(f.oid) as takes,
       has_function_privilege('authenticated', f.oid, 'execute') as authenticated_may_call,
       has_function_privilege('anon', f.oid, 'execute') as anon_may_call
  from pg_proc f join pg_namespace n on n.oid = f.pronamespace
 where n.nspname = 'public' and f.proname = 'public_league_snapshot';
