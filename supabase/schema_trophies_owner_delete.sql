-- Rally — let a player remove a trophy of their own
--
-- Additive migration. One policy. Creates nothing, rewrites nothing.
--
-- Until now the only delete a claimant had was "withdraw your own pending
-- claim" — once a club admin approved it, it was on your profile for good
-- and only they could act on it. That's the wrong way round for an honour
-- you volunteered: nobody else entered it, and wanting it off your own
-- profile isn't a thing you should have to ask permission for.
--
-- Narrow on purpose: claimed_by = auth.uid() and nothing else. It can't
-- touch a trophy an admin recorded against a player row (those have no
-- claimant — the admin's own policy covers them), and it can't touch
-- anybody else's.
drop policy if exists "delete a trophy of your own" on public.trophies;
create policy "delete a trophy of your own"
  on public.trophies for delete
  using (claimed_by = auth.uid());
