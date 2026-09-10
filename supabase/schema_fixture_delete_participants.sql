-- Rally — let the two people in a fixture remove it
--
-- One policy. No data is added, deleted or rewritten.
--
-- WHY
--
-- DELETE on fixtures is "league staff can delete fixtures", so only an owner
-- or editor can remove one. That was fine when a fixture could only be
-- created by an owner generating a season. It stopped being fine when
-- anybody could book a match: you can now make a fixture and have no way to
-- un-make it, and a fixture list you cannot correct is a fixture list people
-- stop believing.
--
-- The app already offers the control to a participant. Until this runs, that
-- control fails visibly rather than silently — deleteRow in
-- lib/leagueData.ts asks for the deleted rows back and raises when none came
-- — but it fails.

drop policy if exists "league staff can delete fixtures" on public.fixtures;
drop policy if exists "participants or league staff can delete fixtures" on public.fixtures;

create policy "participants or league staff can delete fixtures"
  on public.fixtures for delete
  using (
    -- League staff, unchanged.
    exists (
      select 1 from public.league_members lm
      where lm.league_id = fixtures.league_id and lm.user_id = auth.uid() and lm.role in ('owner', 'editor')
    )

    -- Either of the two people it is between. Resolved through
    -- players.auth_id, which is the only identity this app trusts.
    or exists (
      select 1 from public.players pl
      where pl.id in (fixtures.p1, fixtures.p2) and pl.auth_id = auth.uid()
    )
  );
