# Rally — the list, ticked off as it goes

Live tracker. Sam checks this rather than asking. Sources: the 10 Sep brief
(`RALLY_FIX_BRIEF.md`), Sam's "have we missed loads" message of 10 Sep, and
CLAUDE.md §5.

**All SQL Sam needs to run is collected at the bottom.** Nothing is run from
a coding session.

---

## Done and deployed

- [x] **Fonts load before the app** — sign-in and the league picker had no
      webfont, so the first screen was the one screen not in Rally's typeface
- [x] **Tap a name in Messages → their profile**
- [x] **See their photo in Messages**
- [x] **Delete / cancel a fixture** — either participant or league staff
- [x] **Unconfirmed results count towards ratings**
- [x] **Fixture results follow the same agreement rule as logging** — was
      force-confirming results the opponent had never seen
- [x] **Nothing lingers on Fixtures** — resolved fixtures leave the list
- [x] **Cancel an upcoming match** — confirm sheet, records nothing
- [x] **Add a player while logging** — the two-player block is gone, and an
      empty search offers "Add '<name>' as a new player"
- [x] **Wider duplicate detection** — first name, full name or nickname, and
      it only ever asks
- [x] **Book a match uses the real player picker**, not a bare dropdown
- [x] **League invite links** — `?join=CODE`, survives sign-up
- [x] **One date format everywhere** — "Sat 12 Sep 2026 · 2:00pm", London
- [x] **Next Up fixed** — full name, formatted date, actually the next one,
      and a line about your chances
- [x] **No emoji in the UI** — drawn icons via `Glyph.tsx`
- [x] **"How did it go?"** — Home asks once a match should have finished, and
      stops asking after a week
- [x] **Hydration bug on the login screen** — the page was throwing away its
      server HTML and re-rendering from scratch
- [x] **The nudge** — chase a pending result. Needs SQL (below).
- [x] **Re-pick your level** — asked once, "Not now" is a real answer
- [x] **Pictures in messages** — needs SQL (below)
- [x] **Emoji avatars → a drawn set** — no migration needed after all; the
      stored emoji is treated as an id and drawn, so existing players changed
      the moment it deployed
- [x] **A score typed with no winner is no longer lost**
- [x] **"What's new"** — your own Home, not a post to the league
- [x] **Fancy loading screen** — bouncing ball, used on all three waits
- [x] **Cancel tells the opponent** — a message, no migration needed after all
- [x] **The four syncs are ordered** — players, then matches, then fixtures
- [x] **The crash** — hooks below an early return; a check now runs in the gate
- [x] **The dev league actually loads**, which is how the coloured-circle
      avatars got caught
- [x] **Profiles for everyone** — /players/[id], search, tappable friends,
      photo and name mirrored to the account row, signed-out routes closed
- [x] **Search opens the real profile** — the one with rivalries, best wins
      and head to head, not a summary of it
- [x] **The profile is full screen**, not an 88vh sheet
- [x] **A guard for SQL written blind** — `npm run check:sql`, in the gate
- [x] **Head-to-Head favourite %** — turned out to be already built; the note
      in CLAUDE.md predated the scoreboard rebuild. Numbers checked, left
      alone. If something specific is wrong with this screen, say what.

## In progress

## Checked on screen, 2026-09-11 night

Home, Table, Fixtures and Profile all render correctly in the dev league
with drawn avatars, correct records and the search icon in both headers.
Zero emoji anywhere. Opening a player from the Table gives the full profile
full screen; Back returns you where you were.

Not checkable without live Supabase: search results, messages, and the
public profile page for somebody outside your leagues.

## To do

- [ ] **"What's new"** — as a local notification, NOT a post to the league
- [ ] **Home with no league** — currently you cannot get past create-or-join
- [ ] **Friendlies** — a match with no league. Blocked by the above.
- [ ] **Book anyone** — friends, player code, search, not just the league
- [ ] **`assertWritable` throwing takes the whole matches sync with it** —
      not as bad as I first wrote it: it only validates rows being written,
      so an untouched bad row is never seen. Two earlier entries here were
      wrong and have been withdrawn (it does not scan every match, and
      `loggedAt` is persisted — via `created_at`).

## Last, by Sam's instruction

- [ ] **Doubles** — ~70% of the club. Plan written in
      `docs/doubles-readiness.md`. Needs a conversation before code.

## Needed from Sam

- [ ] **The original 13.** CLAUDE.md records items 7, 10, 11, 12 and 13 as
      untouched but never says what they are. Send the list and they go in
      above.

---

## SQL to run

**Nothing outstanding.** All three were run on 2026-09-11:
`schema_message_images.sql`, `schema_match_nudge.sql` and
`schema_public_player_card.sql` (full version, including opponent names on
recent matches). Recorded in CLAUDE.md §6.
