-- Rally — what am I, in each of my leagues? ONE query.
--
-- READ ONLY.
--
-- WHY
--
-- The Level history screen was hiding the estimate editor behind a check on
-- whether the viewer is a league owner or editor, and for Sam — the owner of
-- Seacourt — it was coming back false. The screen no longer asks that question
-- (set_player_level_estimate checks it server side, which is where the answer
-- actually lives), so the screen works either way now.
--
-- But if the row below says anything other than owner or editor for Seacourt,
-- the function will refuse the save with "Only a league owner or editor can
-- set a level estimate" — and that is a membership problem to fix rather than
-- a bug to chase.
--
-- role is the column the app reads. A missing row means no membership at all,
-- which would also explain it.

select l.name                    as league,
       lm.role                   as my_role,
       lm.joined_at,
       (l.created_by = auth.uid()) as i_created_it
  from public.league_members lm
  join public.leagues l on l.id = lm.league_id
 where lm.user_id = auth.uid()
 order by l.name;
