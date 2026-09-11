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
- [x] **Head-to-Head favourite %** — turned out to be already built; the note
      in CLAUDE.md predated the scoreboard rebuild. Numbers checked, left
      alone. If something specific is wrong with this screen, say what.

## In progress

## To do

- [ ] **"What's new"** — as a local notification, NOT a post to the league
- [ ] **Home with no league** — currently you cannot get past create-or-join
- [ ] **Friendlies** — a match with no league. Blocked by the above.
- [ ] **Book anyone** — friends, player code, search, not just the league
- [ ] **Cancel tells the opponent** — needs a soft cancel; SQL below
- [ ] **Fancy loading screen**
- [ ] **The four syncs are not atomic** — a fixture can be marked played with
      no result behind it
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

Nothing here has been run. Each is additive and touches no existing rows.

### 1. Already given to Sam, and run on 2026-09-11

`supabase/schema_fixture_delete_participants.sql` — done, no action.

### 2. `supabase/schema_match_nudge.sql` — NEEDED

Two columns on `matches` (`nudged_at`, `nudged_by`) and a `nudge_match()`
function. Additive; no existing policy changes and no rows touched.

**Until this runs, the Nudge button fails with a visible message.** Everything
else works without it.

Worth knowing why it is a function and not a policy: permissive RLS policies
for the same command are OR'd, so an extra UPDATE policy on `matches` would
have *widened* access and let the reporter rewrite any column on a pending
match. The 24-hour limit is enforced inside the function instead.

### 3. `supabase/schema_message_images.sql` — NEEDED

One nullable `image_url` column on `messages`. No policy changes: the
existing message policies already decide who can see a row.

**Until this runs, sending a picture fails.** Text messages are unaffected.

### 4. Pending — written as the work lands

Collected here as each feature needs one.
