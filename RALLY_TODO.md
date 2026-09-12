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

**Nothing outstanding.** Both were run on 12 Sep 2026.

### One thing to check, not run

```sql
select polname, polcmd, polroles::regrole[], pg_get_expr(polqual, polrelid)
  from pg_policy where polrelid = 'public.profiles'::regclass;
```

If anything there grants `select` to `anon`, every name and photo in Rally is
readable without an account. The app no longer depends on the answer — both
new pages require a session — but nobody has checked.
