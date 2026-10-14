-- Southwood — a club admin can award a trophy to any player in their league
--
-- Additive in effect: widens one insert rule, adds one delete rule. Touches
-- no rows. Safe to re-run.
--
-- Why. Sam, 2026-10-14: "it says i administer seacourt. yet i cant give
-- trophies" — Zaach had just won one. schema_trophies_unclaimed.sql only let
-- an admin record an honour against a player row nobody had claimed; anyone
-- with an account had to claim it themselves and wait for approval. That was
-- built for the club's history (Hugh, 2019, never opened the app). It is the
-- wrong shape for the trophy handed over this weekend: the person giving it
-- out is the admin, and asking the winner to fill in a form so the admin can
-- approve what the admin already knows is theatre.
--
-- What changes:
--   1. can_record_trophy_for() drops "and p.auth_id is null". An admin may
--      record against any player row in a league they are in.
--   2. A player may remove an honour recorded against their own player row.
--      This is the safeguard that replaces the old rule: an admin can put a
--      trophy on your profile, and you can always take it off. Before, an
--      admin-recorded trophy had no claimant and only the admin could delete
--      it — fine for somebody with no account, wrong for somebody who has one.
--
-- Unchanged: the insert still lands 'approved' with the admin stamped as the
-- verifier, still needs is_club_admin(club_id), still demands claimed_by IS
-- NULL — so this path still cannot be used to award yourself anything except
-- as admin of your own club, which you already could by approving your own
-- claim. The claim-and-review flow is untouched for people who want to claim
-- something themselves.
--
-- Grants: can_record_trophy_for is a predicate inside an insert policy, so it
-- is evaluated by the querying role, like is_league_member. It is left off
-- fix_function_grants.sql on purpose. Signed out it answers false anyway,
-- because is_league_member does.

create or replace function public.can_record_trophy_for(p_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.players p
    where p.id = p_id
      and p.league_id is not null
      and public.is_league_member(p.league_id)
  );
$$;

-- Same check as before; renamed because "for an unclaimed player" is no
-- longer true, and a policy name that lies is how the next person misreads it.
drop policy if exists "club admin records a trophy for an unclaimed player" on public.trophies;
drop policy if exists "club admin records a trophy for a player" on public.trophies;
create policy "club admin records a trophy for a player"
  on public.trophies for insert
  with check (
    kind = 'trophy'
    and claimed_by is null
    and player_id is not null
    and status = 'approved'
    and verified_by = auth.uid()
    and public.is_club_admin(club_id)
    and public.can_record_trophy_for(player_id)
  );

drop policy if exists "remove a trophy recorded on your own player" on public.trophies;
create policy "remove a trophy recorded on your own player"
  on public.trophies for delete
  using (
    claimed_by is null
    and player_id in (select p.id from public.players p where p.auth_id = auth.uid())
  );

-- Proves the change itself, not the parts that were already there: the
-- function no longer mentions auth_id, the new insert policy exists and the
-- old one is gone, and the owner's delete policy exists. Expect true, 1, 0, 1.
select
  (select pg_get_functiondef('public.can_record_trophy_for(text)'::regprocedure) not ilike '%auth_id%') as any_player_allowed,
  (select count(*) from pg_policies where tablename = 'trophies' and policyname = 'club admin records a trophy for a player') as new_insert_policy,
  (select count(*) from pg_policies where tablename = 'trophies' and policyname = 'club admin records a trophy for an unclaimed player') as old_insert_policy,
  (select count(*) from pg_policies where tablename = 'trophies' and policyname = 'remove a trophy recorded on your own player') as owner_remove_policy;
