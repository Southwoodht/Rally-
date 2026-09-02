-- Rally — mutual-agreement match deletion
--
-- Additive migration. Run this once in Supabase: SQL Editor -> New query ->
-- paste -> Run. Doesn't touch any existing rows or columns — adds two new
-- nullable columns to matches, and widens the DELETE policy so a
-- participant can delete a match once the other participant agrees, or
-- once 24h of silence has passed. Same "propose, then agree or timeout"
-- shape match edits and new-match confirmation already use. League
-- owners/editors keep deleting freely, unchanged.
--
-- Fixes a real gap in the app today: MatchDetail already shows every match
-- participant a "Delete match" button, but the DELETE policy currently only
-- allows league owner/editor — so a regular participant tapping it sees the
-- match vanish locally, then watches it reappear on the next reload,
-- because Supabase silently rejected the delete. This migration is what
-- makes that button actually do what it already claims to, and adds the
-- agreement step it was missing.

alter table public.matches add column if not exists delete_requested_by text;
alter table public.matches add column if not exists delete_requested_at timestamptz;

drop policy if exists "league staff can delete matches" on public.matches;
drop policy if exists "league staff, or participants by agreement/timeout, can delete matches" on public.matches;
create policy "league staff, or participants by agreement/timeout, can delete matches"
  on public.matches for delete
  using (
    exists (
      select 1 from public.league_members lm
      where lm.league_id = matches.league_id and lm.user_id = auth.uid() and lm.role in ('owner', 'editor')
    )
    or (
      matches.delete_requested_by is not null
      and exists (
        select 1 from public.players pl
        where pl.id in (matches.p1, matches.p2) and pl.auth_id = auth.uid()
      )
      and (
        -- 24h of silence: anyone in the match can now finalize it.
        matches.delete_requested_at < now() - interval '24 hours'
        -- Or the OTHER participant is the one doing the delete — that's
        -- them agreeing, not the requester unilaterally pushing it through.
        or not exists (
          select 1 from public.players pl
          where pl.id = matches.delete_requested_by and pl.auth_id = auth.uid()
        )
      )
    )
  );
