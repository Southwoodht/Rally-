-- Rally — give each league's creator the owner row they should have had
--
-- **THIS WRITES DATA.** One column, on rows where the person who created the
-- league is a member of it and is not marked as its owner. Nothing is deleted,
-- nobody is demoted, and no other league's roles move.
--
-- On the data as at 2026-09-20 it changes exactly one row: Samuel Henry in
-- Seacourt, member -> owner.
--
-- WHY IT HAPPENED
--
-- Seacourt has six members and not one owner. leagues.created_by is Sam's
-- account, so he did create it — but his league_members row says member, and
-- his joined_at is 5 Sep where everybody else joined 23-27 Aug. He left his
-- own league and rejoined it, and joinLeague() writes "member" unconditionally.
-- There has never been a way back: no UPDATE policy on league_members, no UI,
-- and every admin control gated on owner-or-editor. The league had locked its
-- founder out of its own settings.
--
-- schema_league_roles.sql stops it being permanent from here on — an owner can
-- promote somebody. It cannot repair a league that has no owner to start
-- with, which is what this is for.
--
-- WHAT IT DOES NOT FIX
--
-- The cause. joinLeague() still writes "member" for anybody rejoining a league
-- they created, so this can happen again to the next person who leaves and
-- comes back. Worth making joinLeague check created_by — flagged, not done,
-- because it is a code change and this is a repair.

update public.league_members lm
   set role = 'owner'
  from public.leagues l
 where l.id = lm.league_id
   and lm.user_id = l.created_by
   and lm.role <> 'owner';

-- What every league looks like afterwards. Expect exactly one owner per
-- league, and for Seacourt to have gained one.
select l.name                                    as league,
       coalesce(pr.display_name, '(no profile)') as member,
       lm.role,
       (lm.user_id = l.created_by)               as is_the_creator
  from public.leagues l
  join public.league_members lm on lm.league_id = l.id
  left join public.profiles pr on pr.id = lm.user_id
 order by l.name,
          case lm.role when 'owner' then 0 when 'editor' then 1 else 2 end,
          lm.joined_at;
