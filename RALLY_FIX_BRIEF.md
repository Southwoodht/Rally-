# RALLY FIX BRIEF — 10 Sep 2026

This replaces the earlier booking-flow and search briefs. Work through
the whole thing top to bottom without waiting for me. I'm away from the
laptop. Don't stop to ask questions. Use the "blocked" rule below.

## GROUND RULES

- First, save this entire brief to RALLY_FIX_BRIEF.md in the repo root.
  Re-read that file at the start of every phase.
- Work on branch fix/booking-flow. If it already exists, continue on it:
  read RALLY_FIX_REPORT.md and git log first, work out what's done, and
  check the done items actually work before moving on. Don't redo
  working code.
- Commit after each phase. Do not push, merge or deploy.
- Run the typecheck after every phase. It must be clean before the next.
- Never delete or edit existing match, player, league or booking rows.
  Migrations are additive only. If data needs cleaning, write the SQL
  into the report. Do not run it.
- Do not touch src/core/ or the Official ranking formula.
- Blocked? Don't guess. Note it in the report, skip it, and carry on
  with anything that doesn't depend on it.
- Keep RALLY_FIX_REPORT.md at the repo root. It ends with a checklist
  of every phase, each marked done / skipped / blocked.
- Design: existing tokens only (lime #D9E84B, bg-deep #102921, bg-page
  #15352A, bg-card #1D4636, bg-raised #234F3D, text-hi #F5F2E9,
  text-mid #8AA79A, down #F09595). Card radius 20, tile radius 14. No
  new borders; separate by surface colour. Tabular numerals on every
  score, date and time. Negative letter-spacing above 18px. Safe-area
  top padding on every new screen.

## PHASE 0 — DIAGNOSE (read-only)

Write answers into the report before changing anything:

1. When "Add the result" is tapped on a booking, does the save UPDATE
   the booking row or INSERT a new match row? Name the function. Note
   any error handling that could fail silently.
2. Show the last 10 match rows: id, status, score, league_id,
   starts_at, created_at. I added a result to a booking while testing
   and it looked like it didn't save. Work out what happened to it.
3. What filter does the Fixtures screen use? Which statuses?
4. Does a result added from a booking go through the same ratings path
   as "Log a result"? Is league_id null excluded from Official and
   league tables?
5. List every UI surface that can set status to cancelled. Is there
   any delete for matches or bookings?
6. Next Up card: which field gives the opponent's name? Where does the
   date next to "This month" come from, and why is it a raw number?
7. League invites: trace the whole flow (create invite → link → open
   while signed out → sign up → land in league). Find where it breaks.
   Check the invite URL isn't built from localhost or a hardcoded
   origin.
8. Signup: where is a new account forced to join a league? List every
   guard, redirect or query that assumes the user has a league.
9. Log a result: where does the "need at least two people" message
   come from?
10. Emoji audit: every emoji anywhere in UI code or copy. Search the
    unicode emoji ranges, not just the ones you expect. File and line.
11. Player profile popup: how does it open, and every trigger. Does the
    Book a Match picker's Search segment have a reusable search
    function or component?
12. Friends: does any friends concept exist? The Book a Match picker
    has a Friends segment. What's its data source? Is there a claim
    flow for unclaimed players?

## PHASE 1 — RESULTS SAVE ONTO THE BOOKING

- "Add the result" updates the existing booking row. Same id. Never
  create a second row.
- Set the score, result_submitted_by and status: confirmed if the
  opponent is unclaimed, reported if claimed (use isClaimed()).
- Must go through exactly the same ratings path as "Log a result".
  Counts straight away, with the Unconfirmed chip while reported.
- league_id null = Friendly: counts in personal record and H2H only,
  never in Official or any league table.
- No silent failures. If the save fails, keep the form filled, show
  "Couldn't save. Try again." and log the real error.

## PHASE 2 — NOTHING LINGERS ON FIXTURES

- Fixtures shows proposed, scheduled and awaiting only.
- awaiting cards show an "Add the result" action.
- Once a result is saved (reported or confirmed) the match leaves
  Fixtures and appears in results. cancelled and declined never show.
- Home, Next Up and Coming up follow the same rule.

## PHASE 3 — CANCEL AN UPCOMING MATCH

- proposed and scheduled bookings get a "Cancel match" action.
  Secondary pill, #234F3D, same style as "Didn't happen".
- Tapping opens a confirm sheet: "Cancel your match with {Full name}?"
  with "Cancel match" and "Keep it".
- Confirm → status cancelled. Records nothing. Gone from Fixtures,
  Home, Next Up, Coming up and match history.
- Claimed opponent gets an inbox item: "{Full name} cancelled your
  match on {date}". Unclaimed: no notification.
- Either claimed player can cancel.
- If a delete already exists for logged results, make sure it works on
  results that came from bookings. If none exists, don't build one.
  Note it in the report.

## PHASE 4 — ADD NEW PLAYERS WHILE LOGGING

- Remove the "need at least two people" block entirely.
- Opponent picker in both Log a result and Book a match: when the
  search has no match, show a row "Add '{typed name}' as a new player".
- Tapping creates an unclaimed player with the full name as typed
  (trimmed), added to the league the match is in. No league = player
  with no league, and the match is a Friendly.
- Before creating, check for close matches (case-insensitive,
  first-name match, nicknames) across leagues I'm in. If found, show
  "Did you mean {Full name}?" with that player on top. Only create on
  an explicit tap.
- New players behave exactly like every other unclaimed player:
  isClaimed false, skip every agreement step.
- If a claim flow exists, make sure these players can be claimed by
  it. If not, don't build one. Note it in the report.

## PHASE 5 — LEAGUE INVITES WORK

- Fix whatever Phase 0 found.
- New user from an invite link: signs up and lands inside that league
  with a profile.
- Existing signed-in user from an invite link: joins the league, no
  re-onboarding.
- Expired, used or invalid invite: "This invite doesn't work anymore.
  Ask for a new one." No crash, no blank screen.
- Invite URLs use the deployed origin from env config, never localhost.

## PHASE 6 — NO LEAGUE GATE AT SIGNUP

- After signup, land on Home. No forced "join a league" step.
- Profile is a normal profile, just empty: name, avatar, "No matches
  yet".
- Home shows a card "You're not in a league yet" with "Join a league"
  (lime primary pill) and "Create a league" (secondary pill). It stays
  until they join one.
- Table and Fixtures show calm empty states instead of redirecting or
  crashing.
- They can still log a result or book a match. With no shared league
  it's a Friendly (existing rule).
- Fix every guard from Phase 0 item 8 to handle "no league".

## PHASE 7 — DATES AND NEXT UP

### DATES

- One helper, formatMatchDateTime, in shared utils. Output:
  "Sat 12 Sep 2026 · 2:00pm", Europe/London time.
- Use it everywhere an upcoming match shows: Next Up, Fixtures, Coming
  up, booking confirm, inbox items, newsfeed. No raw timestamps or
  numbers anywhere in the app.
- Past results keep their current date format unless it's also raw.
  Then use "12 Sep 2026".

### NEXT UP CARD

- Opponent shows their full name, using the same helper as the
  Messages fix. No display names or usernames.
- Under the name, one line based on the existing prediction for the
  logged-in player (rounded %). Read the prediction engine only. Do
  not change it.
    - 65%+           "You're the favourite for a reason. Play like it."
    - 55–64%         "Slight edge. Don't hand it back."
    - 45–54%         "Coin flip. First to blink loses."
    - 35–44%         "Rally says {n}%. Rally's been wrong before."
    - under 35%      "Nobody's expecting this one. Show them."
    - no prediction  "First meeting. No history, no excuses."
- Line in #8AA79A 13px. The % beside it in #D9E84B, tabular numerals.

## PHASE 8 — NO EMOJIS ANYWHERE

- Remove every emoji found in the Phase 0 audit. Replace with drawn
  SVG in the app's own colours, or with nothing where the emoji was
  decoration.

## CLOSING NOTE FROM SAM

"look amazing for anyone. paste into supabase if u can go for it but if
not build them up ill do in morning."

Interpretation: migrations cannot be run from a coding session (no
database access). Write them into supabase/, list them in the report,
Sam runs them in the morning.
