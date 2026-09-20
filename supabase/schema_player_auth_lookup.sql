-- Rally — turn a player row id into an account id, from outside the league
--
-- Sam runs this. It ends with a select, so a finished run gives a row back.
--
-- WHY
--
-- /players/<id> takes either an account id or a player row id. For the second
-- it has to look up which account that row belongs to, and it did that with a
-- plain read:
--
--     select auth_id from players where id = $1
--
-- which is governed by "read players in your leagues" — league rows are
-- visible only to members of that league. So from an account outside
-- Seacourt, reading Charlie's Seacourt row returns **no rows and no error**,
-- and the page concluded he had no account and said "Not on Rally yet" about
-- three people who have one.
--
-- It is the same mistake as every other one this week: an empty result read
-- as a fact rather than as a refusal. A failed or forbidden read must never
-- look like an answer.
--
-- It also explains why the profile Sam opened from search worked while every
-- opponent he tapped did not — search returns account ids, which skip this
-- lookup entirely, and opponent links carry player row ids, which do not.
--
-- WHAT THIS EXPOSES
--
-- One uuid, or null: does this player row belong to an account, and which.
-- That is strictly less than public_player_card() already gives away — it
-- takes an account id and returns that person's record, form, recent matches
-- and their opponents' names. This adds no new category of thing, it makes
-- the identifier resolvable so the page that already exists can be reached.
--
-- Nothing else on the row is returned: not the name, not the level, not the
-- league it belongs to.

create or replace function public.auth_id_for_player(p_player_id text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select auth_id from public.players where id = p_player_id;
$$;

-- Signed-in only. `from public, anon` and not `from public` alone: Supabase
-- grants execute on a new function to anon directly, so revoking PUBLIC
-- succeeds and leaves anon exactly where it was. See §6.
revoke all on function public.auth_id_for_player(text) from public, anon;
grant execute on function public.auth_id_for_player(text) to authenticated;

select f.proname                                 as created,
       pg_get_function_identity_arguments(f.oid) as takes,
       has_function_privilege('authenticated', f.oid, 'execute') as authenticated_may_call,
       has_function_privilege('anon', f.oid, 'execute')          as anon_may_call
  from pg_proc f join pg_namespace n on n.oid = f.pronamespace
 where n.nspname = 'public' and f.proname = 'auth_id_for_player';
