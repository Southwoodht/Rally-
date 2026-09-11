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

## In progress

- [ ] **The nudge** — chase a pending result. Button exists, was never wired.
      Needs `nudged_at`; SQL below.

## To do

- [ ] **Head-to-Head** — missing the favourite %, and needs simplifying
- [ ] **Re-pick your level** — prompt everyone now six categories exist
- [ ] **"What's new"** — as a local notification, NOT a post to the league
- [ ] **Emoji avatars → a drawn set** — needs `Avatar` changed and a
      migration, because players have the character stored on their row
- [ ] **Pictures in messages**
- [ ] **Home with no league** — currently you cannot get past create-or-join
- [ ] **Friendlies** — a match with no league. Blocked by the above.
- [ ] **Book anyone** — friends, player code, search, not just the league
- [ ] **Cancel tells the opponent** — needs a soft cancel; SQL below
- [ ] **Fancy loading screen**
- [ ] **The four syncs are not atomic** — a fixture can be marked played with
      no result behind it
- [ ] **`assertWritable` scans every match** — one bad row would block every
      match write in the league
- [ ] **A score typed with no winner tapped is lost silently**
- [ ] **`matchToRow` drops `loggedAt`** — set, never stored

## Last, by Sam's instruction

- [ ] **Doubles** — ~70% of the club. Plan written in
      `docs/doubles-readiness.md`. Needs a conversation before code.

## Needed from Sam

- [ ] **The original 13.** CLAUDE.md records items 7, 10, 11, 12 and 13 as
      untouched but never says what they are. Send the list and they go in
      above.

---

## SQL to run

Nothing here has been run. Each is additive and touches no existing rows.

### 1. Already given to Sam, and run on 2026-09-11

`supabase/schema_fixture_delete_participants.sql` — done, no action.

### 2. Pending — written as the work lands

Collected here as each feature needs one. Currently none outstanding.
