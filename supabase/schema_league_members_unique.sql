-- Rally — one membership row per person per league
--
-- READ THIS BEFORE RUNNING. Unlike every other migration in this folder,
-- **this one deletes rows.** It removes duplicate league_members rows and
-- then adds the constraint that stops them coming back. Nothing else is
-- touched: no league, no player, no match, no result. Leaving a league still
-- works exactly as it did.
--
-- WHY
--
-- listMyLeagues() returns one card per membership row, so N membership rows
-- for the same (user, league) render as N identical leagues — same join
-- code, same 25 players, same 106 matches. Leaving one removed all of them,
-- because leaveLeague deletes by (league_id, user_id), which is correct; the
-- list was what was wrong.
--
-- They accumulate because joinLeague inserts and then forgives error 23505:
--
--     if (joinError && joinError.code !== "23505") throw joinError;
--
-- 23505 is a unique-violation. That line assumes a unique constraint exists
-- to raise it. Without one the insert simply succeeds again, every time,
-- silently. This adds the constraint that comment was always relying on.
--
-- It also matters beyond the picker looking wrong: leagueRole is read off
-- whichever card you tapped, and canManageMatches is gated on it. If one
-- duplicate row says 'member' and another says 'owner', tapping the wrong
-- card silently drops you to member permissions — including losing the
-- staff branch of the match DELETE policy.

-- 1. Look first. Run this on its own and read the output before going on.
--    Zero rows means there is nothing to clean up and you can skip to step 3.
select user_id, league_id, count(*) as rows, array_agg(role) as roles
from public.league_members
group by user_id, league_id
having count(*) > 1;

-- 2. Keep one row per (user, league): the strongest role, and among equals
--    the one joined first, so joined_at stays honest.
with ranked as (
  select
    ctid,
    row_number() over (
      partition by user_id, league_id
      order by
        case role when 'owner' then 3 when 'editor' then 2 else 1 end desc,
        joined_at asc
    ) as rn
  from public.league_members
)
delete from public.league_members lm
using ranked r
where lm.ctid = r.ctid and r.rn > 1;

-- 3. Stop it happening again. From here, joinLeague's 23505 branch is real:
--    a second join of the same code raises the violation, the code forgives
--    it, and no row is added.
alter table public.league_members
  drop constraint if exists league_members_user_league_unique;
alter table public.league_members
  add constraint league_members_user_league_unique unique (user_id, league_id);
