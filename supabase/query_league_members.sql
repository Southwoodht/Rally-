-- Rally — who is in my leagues, and what are they. ONE query.
--
-- READ ONLY.
--
-- WHY
--
-- set_player_level_estimate refused Sam with "Only a league owner or editor
-- can set a level estimate" for Seacourt, which he created. So server side
-- there is no league_members row for him in that league with role owner or
-- editor, and there are two quite different reasons that could be true:
--
--   1. The league predates createLeague writing an owner row, so his row
--      says member and always has.
--   2. He created it on a different account. The level-state query showed
--      three Samuel accounts — Samuel Henry in Seacourt, Samuel Truman in
--      Test, and one in no league — so "who created it" and "who is signed
--      in" are not obviously the same person.
--
-- is_the_creator settles it: it compares each member's user_id against the
-- league's own created_by. If somebody other than the signed-in account is
-- the creator, that is case 2. If nobody in the list is the creator, the
-- creator never got a membership row at all.
--
-- me marks the row for whoever runs this.

select l.name                                as league,
       coalesce(pr.display_name, '(no profile)') as member,
       lm.role,
       (lm.user_id = l.created_by)           as is_the_creator,
       (lm.user_id = auth.uid())             as me,
       lm.joined_at
  from public.leagues l
  join public.league_members lm on lm.league_id = l.id
  left join public.profiles pr on pr.id = lm.user_id
 where l.id in (select league_id from public.league_members where user_id = auth.uid())
 order by l.name, lm.role, lm.joined_at;
