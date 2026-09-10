-- Rally — matches that haven't been played yet
--
-- Additive and reversible. It adds no data, deletes no data and rewrites no
-- data. Every existing row keeps the exact values it has: this only widens
-- what a *new* row is allowed to be.
--
-- WHY
--
-- A booking is a match with a date and no result. Two columns forbid that
-- outright today, so the booking feature cannot store anything until this
-- runs:
--
--   winner    text not null    -- a booking has nobody who won
--   league_id uuid not null    -- a friendly belongs to no league
--
-- Run this BEFORE any code writes a booking. The app already refuses to
-- count the new statuses (core/matchStatus.ts), so it is safe to run this
-- and deploy the booking flow later — an empty new column changes nothing.

-- 1. A match can be played without a result yet ---------------------------
alter table public.matches alter column winner drop not null;

-- Existing rows are unaffected: every one of them already has a winner, and
-- dropping NOT NULL never touches stored values.

-- 2. A match can belong to no league (a "friendly") -----------------------
alter table public.matches alter column league_id drop not null;

-- 3. When it is booked for, and how long it is expected to run ------------
-- `date` already carries when a match happened. A booking needs the same
-- field to mean "when it is due", plus an end so the app knows when to ask
-- how it went. Minutes rather than an end timestamp, so rearranging a
-- booking moves one column and cannot leave the two disagreeing.
alter table public.matches add column if not exists duration_minutes int;

-- 4. Who proposed it, and who has agreed ----------------------------------
alter table public.matches add column if not exists proposed_by text;
alter table public.matches add column if not exists responded_at timestamptz;

-- 5. Statuses -------------------------------------------------------------
-- The column stays free text, exactly as it is now — no enum, no check
-- constraint. A CHECK here would have to be kept in step with
-- core/matchStatus.ts by hand, and the one thing this codebase has learned
-- about level_val() is what happens when a copy of app logic lives in SQL
-- and drifts. The app is the authority on what a status means.
--
-- The vocabulary, for reference:
--   proposed   waiting on a claimed opponent to accept
--   scheduled  agreed and still to come  (an unclaimed opponent starts here)
--   awaiting   the time has passed, nobody has entered a result
--   reported   a result is in, the other side hasn't agreed it
--   confirmed  agreed
--   cancelled  it didn't happen
--   declined   the proposal was turned down
--
-- `pending` is the existing name for `reported`. Both are recognised by the
-- app, so no row needs rewriting and there is never a moment where a live
-- row carries a status the code doesn't know.

-- 6. Reading a friendly ---------------------------------------------------
-- The existing select policy is `is_league_member(league_id)`, which returns
-- nothing when league_id is null — so without this a friendly would be
-- invisible to the two people who played it. This adds the participant path
-- and leaves the league path exactly as it was.
drop policy if exists "read matches in your leagues" on public.matches;
create policy "read matches in your leagues"
  on public.matches for select
  using (
    (league_id is not null and public.is_league_member(league_id))
    or exists (
      select 1 from public.players pl
      where pl.id in (matches.p1, matches.p2) and pl.auth_id = auth.uid()
    )
  );

-- Note the second branch also widens league matches slightly: a participant
-- can now read their own match even if they have left the league. That is
-- deliberate — it is their result, and it already shows in their personal
-- record and H2H.

-- 7. Writing a friendly ---------------------------------------------------
-- A league match still needs membership. A friendly needs you to be one of
-- the two players.
drop policy if exists "log a match in your league" on public.matches;
create policy "log a match in your league"
  on public.matches for insert
  with check (
    (league_id is not null and public.is_league_member(league_id))
    or (
      league_id is null
      and exists (
        select 1 from public.players pl
        where pl.id in (matches.p1, matches.p2) and pl.auth_id = auth.uid()
      )
    )
  );

-- UPDATE is deliberately NOT touched. "participants and league staff can
-- edit matches" already resolves through players.auth_id rather than through
-- the league, so it works for a friendly exactly as written — and rewriting
-- it round the league_id check would have quietly dropped the owner/editor
-- moderation branch on the way past.

-- 8. Finding your own bookings quickly ------------------------------------
create index if not exists matches_p1_date_idx on public.matches(p1, date);
create index if not exists matches_p2_date_idx on public.matches(p2, date);
