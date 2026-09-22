-- Rally — let search find people by the name on their league row
--
-- NOT RUN BY A CODING SESSION. Sam runs this.
--
-- RUN query_search_zaach.sql FIRST. If it comes back has_account = false,
-- this file will not help: search returns accounts, and there is no profile
-- to open for somebody who has never signed up. That is a product question,
-- not a SQL one.
--
-- Replaces one function. No table is touched, no policy moves, no data is
-- read or written. Safe to re-run.
--
-- WHY
--
-- Sam searched "zaach" and got nothing. Search matches profiles.display_name
-- — the name typed at sign-up — and players.nick, and nothing else. It has
-- never looked at players.name or players.last, so a league row reading
-- "Zaach Rodriguez" is invisible unless the account happens to repeat it.
--
-- Nothing backfills display_name from the league row, so an account created
-- without typing a name has a blank one, and its owner cannot be found by
-- anybody. The app knows their name perfectly well; it just was not asking.
--
-- This was not a decision that got made wrong. search_player_accounts() was
-- added to solve a narrow problem — "searching Cheese finds nobody unless you
-- are already in their league" — and it solved exactly that. Names were
-- already handled, by display_name, and nobody checked whether display_name
-- was ever populated.
--
-- WHAT CHANGES
--
-- The function now matches name, last, the two joined as a full name, and
-- nick. Still auth_id-only and still returning ids rather than rows, so what
-- can be FOUND widens and what can be READ does not — the rule the original
-- was written to keep.
--
-- The full-name concat is what makes "zaach rod" work, and it is why this is
-- not simply three ORs. btrim on both sides so a stored trailing space cannot
-- break a match, the same wrinkle that produced "Samuel  Henry".

create or replace function public.search_player_accounts(p_query text)
returns table (auth_id uuid)
language sql
security definer
set search_path = public
as $$
  select distinct p.auth_id
    from public.players p
   where p.auth_id is not null
     and p_query is not null
     and length(btrim(p_query)) >= 2
     and (
          p.nick ilike '%' || btrim(p_query) || '%'
       or p.name ilike '%' || btrim(p_query) || '%'
       or p.last ilike '%' || btrim(p_query) || '%'
       or btrim(coalesce(p.name, '') || ' ' || coalesce(p.last, ''))
            ilike '%' || btrim(p_query) || '%'
     )
   limit 20;
$$;

-- `from public, anon`, NOT `from public` alone. The version of this function
-- being replaced carries the public-only revoke, which is why §6 records it
-- as having sat open to anon: Supabase grants execute on a new function to
-- anon DIRECTLY, so revoking PUBLIC succeeds and changes nothing. And
-- `create or replace` counts as newly created, so this re-opens it every
-- single time it runs.
revoke all on function public.search_player_accounts(text) from public, anon;
grant execute on function public.search_player_accounts(text) to authenticated;

-- Expect: authenticated true, anon false.
select f.proname                                              as fn,
       has_function_privilege('authenticated', f.oid, 'execute') as authenticated_may_call,
       has_function_privilege('anon', f.oid, 'execute')          as anon_may_call
  from pg_proc f join pg_namespace n on n.oid = f.pronamespace
 where n.nspname = 'public' and f.proname = 'search_player_accounts';
