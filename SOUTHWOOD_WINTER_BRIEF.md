# Southwood — Winter Pilot Brief

Goal: get Southwood ready to run a Seacourt winter league (Nov–March), set up by the club coach, with as little admin as possible.

Before changing anything, read the existing code for leagues, seasons, competitions, fixtures/bookings, levels and the ratings engine (src/core/). Report what already exists and how it works, then build on it rather than duplicating it. Work in the order below. Finish and test each phase before starting the next.

## PHASE 1 — Must work before the pilot

### 1. Club → Season → Competitions (fix and connect) — TOP PRIORITY
The problem now:
- "League" means three different things in the app: the club/group (Seacourt), the competition format, and the name people give a season. That's confusing.
- Seasons are only a date filter. A season ("Test League", 1 Jan – 31 Dec 2026) is running, but the table shows no season view and no countdown, even though the setup screen promises one.
- Competitions (league/knockout) have no dates, no deadlines, and no connection to a season.

What it should be:
- Rename (UI text only): the top-level "League" becomes "Club" (e.g. "Run your club", "Club settings"). The competition format stays "League". Don't rename database tables unless it's trivial and safe.
- Season = name, start date, end date (required if competitions are attached), and an active/ended status. Only one active season per club.
  - Countdown banner on Home and Table: "Winter 2026/27 · 132 days left".
  - The table gets a clear This season / All time switch. Default to This season while one is active. Check how this relates to the existing "2026" year chip and merge it if they do the same job.
  - When a season ends: it closes automatically on its end date, the final standings are frozen, the season podium shows, and the winners are posted to the Newsfeed.
- Competitions live inside a season.
  - When creating a competition, choose the season (defaults to the active one). It inherits the season's dates.
  - A season can hold several competitions, e.g. "Group A" and "Group B".
  - "Play each player": Once / Twice / Three times. Add Three times.
  - Fixtures get "play by" deadlines, spread evenly across the season, e.g. one round every 2 weeks.
  - Players arrange the actual day and time using the existing booking. A booked time feeds item 5 (the result prompt).
  - Overdue fixtures are flagged. Organisers can extend the deadline, award a walkover, or void the match.
  - Competition table: points (win/draw values as set), then sets, then games. Show played and remaining for each player.
  - Every competition result also counts towards the rating. One result, logged once, updates both.

Done when: an organiser can create "Winter 2026/27" (1 Nov – 31 Mar), add two round-robin groups, and players see the fixtures with deadlines, a countdown, and both the season table and the group tables updating from one logged result.

### 2. Levels set by organisers only
- Only the club owner and organisers ("Who helps run it") can set or change a player's level.
- Players can request a level change; the request goes to the organisers.
- Every level change is logged with the date, so level_history is filled in properly.

### 3. Rating fairness check (investigate first, don't change yet)
- Concern: a player who loses about 9 in 10 to the top player may be gaining rating from the volume of those matches.
- Write a check that recalculates each player's rating with and without their matches against the top-rated player, and reports the difference.
- Confirm whether a loss can ever raise someone's Official rating.
- Report the findings. Don't change the formula without approval.

### 4. Small fixes
- Compare tab warning text uses first names only ("Charlie has played 1… Charlie has played 1"). Use "Charlie E" / "Charlie H" style when first names clash.
- Doubles/singles table: list players below the 5-match cut-off underneath, e.g. "Dan T · 2 more matches to rank", instead of showing "1st of 1".
- "Start a season" screen: the Ends date box runs off the right edge of the card. Fix the layout.
- Data → Clear results: owner only, and the owner must type the club name to confirm. No one-tap wipe.

## PHASE 2 — Keeps people playing during the winter

### 5. "How did it go?" result prompt
- Every booked or scheduled match is assumed to last 1 hour (editable when booking).
- After the end time, the next time either player opens the app they're asked: "How did it go vs [opponent]?" → enter the score.
- The fixture disappears, the result posts, and the tables update.
- The opponent confirms the score. If they don't respond within 48 hours, it confirms automatically. If they dispute it, it goes to the organisers.

### 6. Email notifications
- Challenge sent ("Sam has challenged you — Sunday 4pm"), booking confirmed, result reminder (if nobody has logged within 24 hours), deadline approaching (7 days and 2 days before a play-by date).
- Players can turn emails off in their profile.

### 7. Domination headlines on the Newsfeed
- Games won ÷ games played across all sets, partial sets included.
- 75%+ → "dominates" (e.g. "Zaach dominates Sam — 10 games to 2").
- 90%+ → "demolition".

### 8. First-meeting post
- Check whether this already exists. If not: "Sam and Dan T play for the first time" on the Newsfeed.

### 9. Short / unfinished matches
- A new match type: Short or unfinished (e.g. a quick 3-0 that wasn't a full set).
- Shown on the Newsfeed and in head-to-head, labelled "short match".
- Does not count towards the rating or competition tables, so nobody can farm points.

## PHASE 3 — After the pilot is running

### 10. Automatic divisions/boxes
- Organisers choose a group size (5–6). The app seeds groups by rating, strongest first.
- Promotion and relegation at the end of the season (top player up, bottom player down).
- For this winter, groups will be picked by hand with the coach using item 1.

### 11. LTA rating as a starting level
- Players can enter their own LTA rating at signup. It sets their starting level only.
- Organisers can override it (see item 2), and results take over from there.
- Don't pull data from the LTA. Self-entered only.

### 12. Find players nearby
- Opt-in only. Shows the rough area and distance ("Fareham · 3 miles"), never an exact location.
- Lists players of a similar level who are open to challenges.
