-- Rally — friends, and mutual friends, on a profile
--
-- NOT RUN BY A CODING SESSION. Sam runs this.
--
-- Additive: one function. No table is altered, no policy is changed, no row
-- is read or written by running it. Until it runs, the Friends section on a
-- profile shows nothing at all and every other part of the profile is
-- untouched — the app checks and degrades, the way the level estimate and the
-- nudge do.
--
-- WHY A FUNCTION
--
-- `friends` has exactly one select policy:
--
--   using (requester_id = auth.uid() or addressee_id = auth.uid())
--
-- so you can read a friendship only if you are IN it. That is the right rule
-- and it is why nothing client-side can ever show you somebody else's friend
-- list: not a missing query, a closed door. A security-definer function is
-- the only way through, which also makes it the only place the decision
-- below is written down.
--
-- ** THIS WIDENS WHAT IS VISIBLE. READ THIS PARAGRAPH BEFORE RUNNING IT. **
--
-- After this, any signed-in account can see who any other account is friends
-- with. That is what "just like Facebook" means and it is what Sam asked for
-- on 2026-09-23 — but it is a real change and worth stating rather than
-- discovering. It is the same shape of decision as public_player_card, which
-- Sam took deliberately in September having been shown the narrower option.
--
-- The narrower option here, if you want it instead: return only the MUTUAL
-- friends and the total count, never the full list. You would learn "you both
-- know Charlie, and they have 14 friends" without being able to enumerate
-- somebody's address book. Delete the `friends` array from the return and the
-- app degrades to exactly that. Say the word and I will ship it that way.
--
-- What it does NOT widen: pending requests are invisible either way. Only
-- accepted friendships are returned, so a request somebody has not answered
-- stays between the two of them, which is the part that would actually
-- embarrass someone.

create or replace function public.public_friends_of(p_auth_id uuid)
returns table (
  auth_id      uuid,
  display_name text,
  avatar_url   text,
  is_mutual    boolean
)
language sql
security definer
set search_path = public
as $$
  with theirs as (
    -- Their accepted friendships, flattened to "the other person".
    select case when f.requester_id = p_auth_id then f.addressee_id else f.requester_id end as other
      from public.friends f
     where f.status = 'accepted'
       and (f.requester_id = p_auth_id or f.addressee_id = p_auth_id)
  ),
  mine as (
    -- The caller's, the same way. auth.uid() is null in the SQL editor, so
    -- this is empty there and is_mutual comes back false for every row —
    -- correct, and worth knowing before anybody debugs it from there. §6.
    select case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end as other
      from public.friends f
     where f.status = 'accepted'
       and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
  )
  select p.id,
         p.display_name,
         p.avatar_url,
         (t.other in (select other from mine)) as is_mutual
    from theirs t
    join public.profiles p on p.id = t.other
   -- Never the viewer themselves: "you are friends with you" is noise on
   -- every profile you open.
   where t.other <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
   order by (t.other in (select other from mine)) desc, p.display_name
   limit 200;
$$;

-- `from public, anon` and not `from public` alone. Supabase grants execute on
-- a new function to anon DIRECTLY, so revoking PUBLIC succeeds and leaves anon
-- exactly where it was — which is how six functions sat open for a fortnight
-- with a correct-looking revoke in every file. And `create or replace` counts
-- as newly created, so this re-opens on every re-run. See §6.
revoke all on function public.public_friends_of(uuid) from public, anon;
grant execute on function public.public_friends_of(uuid) to authenticated;

-- Expect: authenticated true, anon false.
--
-- Aliased fnc rather than the usual f: this file already binds f to
-- public.friends in the CTEs above, and check:sql resolves aliases per file,
-- so f.proname read as "proname on friends" and failed the gate. The checker
-- was right to ask; the alias was the problem.
select fnc.proname                                                 as created,
       pg_get_function_identity_arguments(fnc.oid)                 as takes,
       has_function_privilege('authenticated', fnc.oid, 'execute')  as authenticated_may_call,
       has_function_privilege('anon', fnc.oid, 'execute')           as anon_may_call
  from pg_proc fnc join pg_namespace n on n.oid = fnc.pronamespace
 where n.nspname = 'public' and fnc.proname = 'public_friends_of';
