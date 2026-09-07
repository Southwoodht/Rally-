-- Rally — the two deletes the agreement policy forgot
--
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- It replaces one policy and touches no rows and no columns.
--
-- WHY
--
-- schema_match_delete_agreement.sql widened DELETE so a participant could
-- remove a match once the other participant agreed, or after 24h of silence.
-- Both of its branches require `delete_requested_by` to be set. The app has
-- two paths that delete without ever setting it, and both are correct to:
--
--   1. A match against a SHELL opponent — a player row with no auth_id, so
--      there is nobody who could ever agree. RallyApp's proposeDelete deletes
--      these outright, which is right: waiting 24 hours for the agreement of
--      somebody who does not have an account is waiting for nothing. The
--      policy had no branch for it, so the row vanished from the screen and
--      came back on the next load.
--
--   2. Dispute and Cancel on a PENDING match. A result nobody has agreed to
--      is not a shared record yet — it is one person's claim, and either
--      person should be able to throw it away without a ceremony. The app's
--      disputeMatch does exactly that and the policy refused it.
--
-- Neither failed loudly, because **a DELETE that RLS refuses is not an error
-- in Postgres** — it matches no rows and reports success. The app now checks
-- that the row actually went (see deleteRow in lib/leagueData.ts), which is
-- what finally surfaced this as "Couldn't save".
--
-- Nothing here lets anyone touch a match they are not in. Both new branches
-- still require the caller to be one of the two players.

drop policy if exists "league staff can delete matches" on public.matches;
drop policy if exists "league staff, or participants by agreement/timeout, can delete matches" on public.matches;
drop policy if exists "league staff, or participants by agreement, timeout, shell or pending, can delete matches" on public.matches;

create policy "league staff, or participants by agreement, timeout, shell or pending, can delete matches"
  on public.matches for delete
  using (
    -- League staff, unchanged.
    exists (
      select 1 from public.league_members lm
      where lm.league_id = matches.league_id and lm.user_id = auth.uid() and lm.role in ('owner', 'editor')
    )

    -- A participant, once the other agreed or 24h passed. Unchanged.
    or (
      matches.delete_requested_by is not null
      and exists (
        select 1 from public.players pl
        where pl.id in (matches.p1, matches.p2) and pl.auth_id = auth.uid()
      )
      and (
        matches.delete_requested_at < now() - interval '24 hours'
        or not exists (
          select 1 from public.players pl
          where pl.id = matches.delete_requested_by and pl.auth_id = auth.uid()
        )
      )
    )

    -- NEW: a participant, when the opponent is a shell with no account.
    -- There is nobody to agree, so there is nothing to wait for.
    or (
      exists (
        select 1 from public.players me
        where me.id in (matches.p1, matches.p2) and me.auth_id = auth.uid()
      )
      and not exists (
        select 1 from public.players other
        where other.id in (matches.p1, matches.p2)
          and other.auth_id is not null
          and other.auth_id <> auth.uid()
      )
    )

    -- NEW: a participant, when the match is still pending. Nobody has agreed
    -- to it, so it is one person's claim rather than a shared record —
    -- Dispute and Cancel both land here.
    or (
      matches.status = 'pending'
      and exists (
        select 1 from public.players pl
        where pl.id in (matches.p1, matches.p2) and pl.auth_id = auth.uid()
      )
    )
  );
