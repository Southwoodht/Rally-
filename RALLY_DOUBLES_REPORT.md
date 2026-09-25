# Rally — doubles and pairs competitions

Branch `feature/doubles`. **Nothing has been changed yet.** This is A0, the
audit the brief asks for before any code, plus three things that need a
decision from Sam because the brief assumes something this codebase does not do.

---

## STOP — three things before A1

### 1. I cannot take the database backup

The brief's first instruction is "before Phase A1, export a backup of the
database. Tell Sam where it is." I can't. A coding session can read this repo
but cannot query or dump Supabase — that is §6 and §9 of CLAUDE.md, and it is
why every migration in `supabase/` is run by hand.

**Sam does this:** Supabase dashboard → Database → Backups, or
`pg_dump`. It belongs outside the repo; `backups/` is gitignored and holds real
player PII.

I am not treating this as optional. Part A adds tables and a league column to a
live database with real clubs in it.

### 2. "All rating calculations stay server-side, like singles" — singles is not server-side

This is the finding that matters most, because a whole section of the brief
rests on it.

**Every league rating in Rally is computed in the browser.** `computeStats()`
and `computeOfficial()` run inside React memos — `RallyApp.tsx:778`,
`LeagueHome.tsx:47`, `events.tsx:29`, `achievements.ts:80`. Nothing about the
league table is computed in Postgres. The app holds no stored Elo at all: it
replays every match from history on each render, which is exactly why a level
history entered today retroactively regrades a 2019 match.

The only server-side rating in the app is the **Global** table
(`global_standings()`, `global_edges()`), which is a different feature.

There is also no API-route layer to put a server calculation in: `src/pages/api`
contains one diagnostic endpoint and nothing else.

So "stay server-side, like singles" cannot be followed as written. Three
options, and I need a ruling:

| | what it means | cost |
|---|---|---|
| **A. Match singles** (recommended) | doubles Elo computed in `src/core/doubles/` in the browser, same as every other rating in the app | no new infrastructure; one consistent model; the A3 live "Rating" strip is free, because the same function runs in the client already |
| **B. Postgres function** | a `doubles_ratings()` security-definer function, like `global_standings()` | a second place the maths lives, in a language that cannot import `constants.ts`; §6 already records what SQL/TS duplication costs (`level_val()`) |
| **C. Next API route** | a new server layer | new infrastructure for one feature; every rating read becomes a round trip |

**My recommendation is A**, and it makes the rest of the brief simpler rather
than harder. If the intent behind "server-side" was *"players must not be able
to forge their own rating"*, note that this is already true of singles and stays
true under A: the ratings are derived from `doubles_matches` rows, and it is the
**rows** that RLS protects. A client that lies about its own Elo convinces only
itself — everyone else recomputes from the same matches.

### 3. There is no "player's league stats" to add doubles fields to

A2/A1 say to add `doubles_elo`, `doubles_played` and so on "to the player's
league stats, or a `doubles_player_stats` table, whichever fits the existing
pattern."

**Neither fits, because the existing pattern is to store no stats at all.** The
`players` table has no Elo, no played/won/lost, no streak — every one of those
numbers is derived. CLAUDE.md is explicit that nothing caches a computed value,
and the reason is the Charlie incident's cousin: a cached number and a recomputed
number eventually disagree, and nobody notices which is wrong.

The brief's doubles model — a stored `doubles_elo` seeded at 1500, a
`doubles_rating_history` audit trail, and a full recompute when an old match is
edited — is a **different model in kind** from singles, not a port of it. It is
internally coherent and the audit trail is genuinely nice. But it means Rally
would hold two philosophies at once, and the stored copy can drift from the
recomputed truth after any failed write.

Under option A above the tension disappears: doubles Elo is derived from
`doubles_matches` in `played_at` order, so "recompute after an edit" is not a
special path — it is the only path, and it cannot drift. `doubles_rating_history`
then becomes optional: worth keeping if Sam wants "you went from 1532 to 1542 in
that match" on the match detail screen, which singles already answers with
`ratingBefore`.

---

## A0 — the audit

### How a singles match is stored

`public.matches`, in `supabase/schema_players_matches.sql`:

```
id text pk · league_id uuid · p1 text · p2 text · date timestamptz
winner text ('p1' | 'p2' | 'draw') · score text · status text ('confirmed' | 'pending')
reported_by text · notes · venue · photo_url · category · pending_edit jsonb
created_at · updated_at
```

Two facts that will bite the A1 migration if they are missed:

- **`players.id` is `text`, not `uuid`** — the app's own short id. `matches.p1`
  and `p2` are `text` references. So `doubles_matches.team_a_p1` and its three
  siblings must be `text`. This is the exact mistake §6 records against
  `trophies.player_id`, where every other reference in the table was a uuid and
  the player one could not be.
- **`matches.id` and `fixtures.id` are `text` too.** The brief specifies
  `doubles_matches.id` as uuid, which is fine for a new table, but
  `fixture_id` must be `text` to reference `fixtures(id)`.

There is **no set-by-set column.** Set scores live inside the free-text `score`
column as `"6-2, 6-3"` and are parsed by `core/sets.ts`, which deliberately
assumes no player-one-first convention and refuses a score it cannot reconcile
against the recorded winner. The brief's `sets jsonb` for doubles is therefore
*better* than singles, not the same as it — worth knowing, since it means
doubles score handling cannot simply reuse the singles path.

### How a result is entered, confirmed, and becomes a rating

- **Entered:** `components/games/LogResult.tsx`. Picks two players via
  `PlayerPicker`, takes a winner and an optional free-text score.
- **Confirmed:** `core/matchStatus.ts` decides pending vs confirmed. The rule is
  that an opponent holding an `auth_id` must agree; a shell opponent with no
  account confirms immediately because there is nobody to ask. Edits and deletes
  need the same agreement, enforced in RLS as well as the UI, with a 24h
  client-side sweep.
- **Rating:** nowhere, as a write. `computeStats(players, matches)` derives it
  on render. A match becomes a rating the moment it is in the array.

Doubles has to extend the agreement rule to "either opponent may confirm", which
is new shape — singles only ever has one other party.

### Where each piece lives

| piece | file |
|---|---|
| Elo | `core/elo.ts` — `computeStats`, level-gap multiplier, also returns `ratingBefore` |
| Official points | `core/official.ts` — `computeOfficial`, five best wins × win rate² × activity |
| Network rating | `core/rating.ts` — `computeRatings`, drives Global and the Table's Strength mode |
| Predictions / odds | `core/predict.ts` |
| Newsfeed items | `components/games/events.tsx` — replays history to build events |
| Fixtures / bookings | `core/booking.ts`, `components/games/FixturesPanel.tsx` |
| Home rank card | `components/home/Home.tsx`, `home/StandingHero.tsx` |
| Table | `components/table/LeagueHome.tsx`, `table/StandingsList.tsx` |
| Profile | `components/profile/ProfileView.tsx` over `ProfileContainer.tsx` |
| New match | `components/games/LogResult.tsx` |
| Row ↔ app shape | `lib/leagueData.ts` — `rowToMatch` / `matchToRow`, `syncEntity` |

### Everywhere that assumes exactly two players

**39 files, 361 references to `p1`/`p2`.** Not changing any of them, as
instructed — this is the list so nothing is touched by accident:

`core/`: elo, official, rank, predict, tiebreak, season, legacy, rivalries,
memories, notifications, achievements, feedContext, matchQuality, matchStatus,
ratingTimeline, sets (+ their tests)

`components/`: RallyApp, LogResult, MatchDetail, History, FixturesPanel,
WeeklyRoundup, events, bulk, Home, ResultPrompt, ProfileContainer, SettingsTab,
LeagueHome, RecapCard, HeadToHead

`lib/`: leagueData, format, historyImport · `data/seed.ts`

The concentration in `core/` is why the brief is right that doubles belongs in
`core/doubles/` rather than in a generalised engine. Widening `p1`/`p2` into
arrays would touch every rating, every screen and every test in one change, on a
live app, with no CI.

### Feature flags

`public.leagues` currently has only `id, name, location, join_code, created_by,
created_at`. Both flags are new columns — additive, defaulting false, no row
rewritten.

---

## What I have not done

Everything after A0. No migration written, no table created, no component
touched, nothing committed beyond this file. A1 is blocked on the backup, and
A2's shape depends on the ruling in point 2 above.

**What I need from Sam:**

1. Take the database backup and say where it is.
2. Rule on point 2 — A (compute like singles, recommended), B (Postgres
   function) or C (API route).
3. Confirm point 3 follows from that: under A there is no stored
   `doubles_elo`, and `doubles_rating_history` becomes optional rather than the
   source of truth.

Say "A" and I will build Part A straight through — the A2 worked example still
has to produce +10.35 and +13.80 whichever option is chosen, so the maths and
its tests are unaffected either way.
