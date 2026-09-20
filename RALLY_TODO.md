# Rally — where things stand

Last updated **20 Sep 2026**, end of a long session.

Rollback point: **`rally-checkpoint-2026-09-20`**. Everything below is
deployed, gated (tsc · check:sql · hook-order · **340 tests** · build) and
live. The previous point is `rally-pre-holiday-2026-09-12`.

---

## Read this first if you are picking it up cold

**All migrations are run as of 20 Sep 2026.** Nothing is pending. Every
security-definer function is closed to `anon` except `is_league_member` and
`is_club_admin`, which must stay open — see §6 of CLAUDE.md before touching
them.

**Run `supabase/fix_function_grants.sql` after EVERY migration**, not once.
Supabase grants execute on a new function to `anon` by default, and a
`create or replace` counts as new — so re-running
`schema_public_player_card.sql` reopens two functions every single time.

### What happened on 20 Sep, in one list

- **Friendlies** — three silent bugs fixed (your account id never set, mates
  you added were uneditable, booking hit a not-null). Still not verified end
  to end with a real session.
- **Level estimates** — a league owner or editor can fill in a level for
  somebody who has an account and never set one. Their own claim always wins,
  it never leaves the league, and it never reaches the global table.
- **anon could call `public_player_card`** — records, form, recent matches and
  opponents' names, readable signed out. Closed, along with five others that
  were open but leaked nothing.
- **The restricted profile** — `public_league_snapshot` had never been created.
  Plus `auth_id_for_player`, because resolving a player id through an
  RLS-gated read told three people with accounts that they had none.
- **The robin**, redrawn and re-timed.
- **The career line** on your profile — every match you have played, tappable.
- **Strength** on the league table: the network rating, as a sixth mode.
- **Official weighs a loss by the gap** now. Measured before applying.
- **Seacourt had six members and no owner.** Sam created it, left, rejoined,
  and `joinLeague` writes "member". Repaired; the cause is still there.
- **Role management** — an owner can make somebody an editor and hand the
  league on.

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

- [ ] **Decide the level badge question.** George's profile says "Beginner ·
      Medium" (his own dropdown) while his September matches grade as
      "Amateur · Medium" (Sam's estimate timeline). Both are working as built
      and they disagree on screen. Either his own claim wins everywhere and
      the estimate stops grading recent matches, or a dated timeline beats an
      undated dropdown and the badge shows the estimate, marked as such.
      **Sam's call, recommended the second.**
- [ ] **`joinLeague` demotes a returning creator.** It writes "member"
      unconditionally, so anyone who leaves and rejoins a league they created
      loses ownership with no way back from inside the app. It should check
      `leagues.created_by`. This is what happened to Seacourt.
- [ ] **The opponent-strength line** on the profile's Elo chart — a second,
      quieter line showing how strong the people you were playing were.
      Approved by Sam, never built. `ratingBefore` already holds it.
- [ ] **A shareable result card** — a good-looking scoreline that goes
      straight into WhatsApp. The only idea of the three that brings new
      people to Rally.
- [ ] **`players` INSERT never checks `auth_id`.** A signed-in user can
      create a player row carrying somebody else's account id, and the global
      table groups by account id. Nobody has; it should not be possible.
- [ ] **Is the test account in Seacourt or in no league?** Unanswered, and it
      decides whether "can't add a match against a friend" is a bug or the
      unbuilt feature below.
- [ ] **Should Strength be the league default?** It matches how Sam ranks the
      club in his head and it makes the league and global tables agree. Worth
      a week of looking at it first. Note Adrian's nine matches are all
      against Zaach — a selective sample, and Strength is the formula most
      sensitive to that.
- [ ] **Friendlies, end to end.** The app path and the SQL are both in. Not
      verified with a real session — the dev league cannot provide one.
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
