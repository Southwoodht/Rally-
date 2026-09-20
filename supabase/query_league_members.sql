-- Rally — every league, every member, every role. ONE query, no auth.uid().
--
-- READ ONLY.
--
-- **NO auth.uid() ANYWHERE, and that is the point.** The first version of this
-- filtered to "leagues I am in" with `where l.id in (select ... where user_id =
-- auth.uid())` and came back "Success. No rows returned" — correctly. In the
-- Supabase SQL editor you are the service role and auth.uid() is null, so any
-- query that leans on it matches nothing.
--
-- §6 already records this for global_edges(), and it is the same reason
-- set_player_level_estimate cannot be called from the editor. Writing a
-- diagnostic that depended on it was avoidable and cost a round trip.
--
-- So this lists everything and lets you find your own row by name. It is your
-- database; there is nobody to hide it from.
--
-- WHAT TO LOOK FOR
--
--   * a row for Seacourt with role = 'owner' — is there one at all?
--   * is_the_creator — whose account actually made the league
--   * whether the Seacourt owner (if any) is the same person as the Samuel
--     Henry who plays in it
--
-- Three Samuel accounts turned up in the level-state query — one in Seacourt,
-- one in Test, one in no league — so "who created it" and "who is signed in"
-- are not safely the same person.

select l.name                                    as league,
       coalesce(pr.display_name, '(no profile)') as member,
       lm.role,
       (lm.user_id = l.created_by)               as is_the_creator,
       lm.user_id,
       lm.joined_at
  from public.leagues l
  join public.league_members lm on lm.league_id = l.id
  left join public.profiles pr on pr.id = lm.user_id
 order by l.name,
          case lm.role when 'owner' then 0 when 'editor' then 1 else 2 end,
          lm.joined_at;
