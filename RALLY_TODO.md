# Rally — where things stand

Last updated **12 Sep 2026**, before Sam's holiday.

Rollback point: `rally-pre-holiday-2026-09-12`. Everything below that date is
deployed, gated (tsc · check:sql · hook-order · 268 tests · build) and live.

---

## Read this first if you are picking it up cold

**All migrations are run as of 12 Sep 2026.** Nothing is pending.

The one that changed an invariant: `players.league_id` is no longer
`not null`, so a player can exist outside any league. Anything assuming a
player has a league must cope with null.

**The schema is in this repo.** `supabase/schema.sql` and
`supabase/schema_players_matches.sql` hold the real `create table`
statements. Read them before writing SQL. `npm run check:sql` enforces it.

---

## Done and live

The whole of the 10 Sep brief, the profiles work, and a run of fixes:

- **Booking loop closes** — Home asks "How did it go?" once a match should
  have finished, and stops asking after a week
- **The nudge** — chase a result you logged, once a day, enforced server-side
- **Cancel a match** — confirm sheet, and it messages the other person
- **Add players mid-flow** — no more "two players first"; wider duplicate
  detection that asks and never decides
- **Invite links** — `?join=CODE`, survives sign-up
- **One date format** everywhere, Europe/London
- **Next Up** — full name, real next match, a line about your chances
- **Re-pick your level** — asked once
- **What's new** — your own Home, never a post to the league
- **Drawn avatars** — including the coloured circles the whole club uses
- **Pictures in messages**
- **A loading screen** worth looking at
- **Profiles for everyone** — `/players/[id]`, player search, tappable
  friends, photo and name mirrored to the account row
- **Search opens the real profile**, not a summary of one
- **Profiles are full screen**, not a sheet
- **Saves are ordered** — players, then matches, then fixtures

### Fixes worth remembering

- A crash from hooks below an early return. There is now a check in the gate.
- A hydration bug that made the login screen discard its server HTML.
- `resolveFixture` force-confirming results the opponent never agreed to.
- A score typed with no winner being lost silently.
- `/players/[id]` and `/search` rendering for signed-out visitors.

---

## Still to do

- [ ] **Friendlies, end to end.** The SQL and the app path are both written.
      Not verified end to end — the friendly boot needs a real session, and
      the dev league cannot provide one. **Try it first after running the
      migration.**
- [ ] **Home with no league.** Still only reachable as Friendlies. `RallyApp`
      takes a `leagueId` and reads that league on mount; running truly
      league-less is a boot-path change for every user.
- [ ] **Book anyone outside your league.** Challenge needs a shared league,
      because a fixture belongs to one. Friendlies is the groundwork.
- [ ] **Public profile gaps**, all deliberate: rankings need a shared league,
      best wins need opponent ratings replayed over league history, and the
      head-to-head card hides when you have never played them.
- [ ] **`assertWritable` throwing takes the whole matches sync with it** — a
      save half applied, reported as one failure.
- [ ] **Doubles** — ~70% of the club, and last by Sam's instruction.
      `docs/doubles-readiness.md` is the written plan. **Talk it through
      before building.**

---

## SQL

**Nothing outstanding, as of 20 Sep 2026.** Everything is run, including
`schema_public_league_snapshot.sql` (which had never been created — it was the
whole of the "restricted profile"), `schema_public_player_card.sql` re-run,
`schema_friendly_fixtures.sql` and `schema_level_estimate.sql`.

### Run `fix_function_grants.sql` after every migration

Not once — every time. Supabase grants EXECUTE on a new function to `anon` by
default, and `create or replace` and drop-and-recreate both count as new. So
**re-running `schema_public_player_card.sql` re-opens two functions to the
signed-out role every single time**, silently.

The revoke at the bottom of most schema files says `from public`, which
removes a grant that was never carrying the access — it succeeds and changes
nothing. That is how six functions sat open from 4 to 20 September with a
correct-looking line in every file. `revoke ... from public, anon` is what
closes it, and `fix_function_grants.sql` does all of them at once. It is
idempotent and skips functions that do not exist, so it is free to run.

`is_league_member` and `is_club_admin` stay open to `anon` **on purpose** and
are deliberately not in that file. They are the predicates inside the row
policies — `is_league_member` appears in fourteen `using` / `with check`
clauses — and a policy's function call is made by the querying role, so
revoking them turns a signed-out "no rows" into a permission error across
players, matches, fixtures and posts. They also answer only "am I in this
league", which signed out is false and reveals nothing.

### The profiles question, answered

Checked on 20 Sep 2026, and the answer is good: `public.profiles` is **not**
readable by `anon`. Two policies, `any signed in user can search profiles`
(select, `auth.uid() IS NOT NULL`) and `edit your own profile` (update,
`id = auth.uid()`). No session, no `auth.uid()`, no rows. Closed.
