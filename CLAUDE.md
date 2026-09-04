# Rally — working notes for Claude

Head-to-head rankings for racket sports. Real app, real users, real data:
Sam's club (Seacourt) plus a few others are live in it. Treat production
data as sacred — see **The Charlie incident** in §3 for why.

Read this before touching anything. It exists so you don't have to
re-derive the reasoning from the commit log every session.

---

## 1. The shape of the thing

| | |
|---|---|
| Stack | Next.js 14 (app router) · TypeScript · Tailwind · Supabase |
| Repo | `Southwoodht/Rally-` on GitHub, branch `master` |
| Deploy | Vercel, auto-deploys from `master`. **A push is a deploy.** |
| Rollback tag | `v1.1-global-table` (also `rally-golden-2026-08-15`, `rally-pre-deployment-2026-08-19`) |
| Dev server | `npm run dev` → :3000, or the `rally-dev` config in `.claude/launch.json` |
| Checks | `npx tsc --noEmit` and `npm run build`. There are no tests. |

There is no CI. The build passing locally is the only gate before a push
becomes a live deploy, so run it.

`README.md` is from the original prototype conversion and is **stale** in
places — it says `storage.ts` uses browser storage (it's Supabase now) and
references `core/types.ts` (doesn't exist). Trust this file over it.

---

## 2. Layout

```
src/app/            layout, page → AuthGate
src/core/           THE RATINGS ENGINE. Pure TS, no React, no browser.
                    Deliberately portable so it can move server-side later.
src/lib/            Supabase access, theme tokens, small helpers
src/components/     UI, split by area
supabase/*.sql      migrations — Sam runs these by hand, see §6
docs/               doubles-readiness.md is the doubles plan, already written
```

Boot path: `page.tsx` → `AuthGate` (session / setup / password recovery) →
`Dashboard` (league list, create, join, leave, picker) → `RallyApp`
(everything else, one league at a time, ~580 lines and the hub for all state).

### The ratings engine (`src/core/`)

- `constants.ts` — `START_ELO=0`, `K=40`, `LEVELS` (**6 categories**:
  Beginner, Amateur, Intermediate, Advanced, Semi-pro, Pro), `SUBS` (3),
  `LV_FACTOR/LV_MIN/LV_MAX` for level-gap weighting, `WIN_QUALITY_DIVISOR`.
  The four original category names are load-bearing: level is stored as
  `{cat, sub}` strings and looked up by name, so **adding to `LEVELS` is
  safe, renaming or reordering is not** — it would leave every stored level
  unresolvable and silently unrated.
- `sets.ts` — set-by-set scores. They live inside the existing free-text
  `score` column as `"6-2, 6-3, 6-2"`, so there's no schema for them. The
  old free text had no player-one-first convention (a `"6-4"` sits on a
  match p2 won), so nothing assumes direction: it reads the numbers as
  written and resolves them against the recorded result, refusing a score it
  can't reconcile rather than guessing.
- `levels.ts` — `levelVal()` maps a `{cat, sub}` to `ci*3+si`, i.e. the
  current **0–17, 18-point scale**. `levelAt(player, ts)` reads
  `levelHistory` so an old match is judged on who the opponent was *then*,
  never today's claim. Timeline boundaries are either a bare year (legacy)
  or `"YYYY-MM"`; `monthIndex()` normalises both.
- `elo.ts` — `computeStats(players, matches)` returns `{elo, wdl, form, deltas}`.
  Level-gap multiplier on the K-factor. Honours `initialElo`/`initialRecord`
  from onboarding.
- `official.ts` — the league's Official points. Your five best wins by
  opponent quality × regularised win rate² × an activity term that saturates.
- `rank.ts` — `rankMaps()` gives `{off, el, rec}` rank maps.
  `matchContext()` replays history to reconstruct ELO/points/rank either
  side of one match (drives Match detail).
- `difficulty.ts` — the six-tier opponent bar (gold/silver/blue/green/
  orange/red + muted). Fixed hex vocabulary, *not* brand tokens.
- Also: `predict.ts`, `season.ts`, `legacy.ts`, `achievements.ts`,
  `rivalries.ts`, `memories.ts`, `notifications.ts`.

### Data access (`src/lib/`)

- `supabase.ts` — client + `withSupabaseTimeout` (4s). Missing env vars show
  a setup screen, never a blank page.
- `leagueData.ts` — the real `players`/`matches`/`fixtures`/`posts` tables
  and the row↔app-shape mapping. `syncEntity()` diffs prev vs next and
  writes only what changed, so one bad save can't rewrite a whole league.
- `storage.ts` — `shared_storage` / `user_storage` key-value, used for
  per-league settings and similar. Carries the `READ_FAILED` /
  `WRITE_UNCONFIRMED` sentinels: **a failed read must never look like an
  empty result**, because callers treat empty as licence to seed fresh data
  over whatever's really there. Same discipline in `leagueData.ts`.
- `globalTable.ts` — the cross-league table. Also `leagues.ts`, `friends.ts`,
  `messages.ts`, `profiles.ts`, `clubs.ts`, `trophies.ts`,
  `myLeaguePlaces.ts`, `historyImport.ts`, `photo.ts`.
- `theme.ts` — every colour and style token. Court green `#15352a`, ball
  yellow `#d9e84b`, clay `#cb6d47`, chalk `#f5f2e9`.

---

## 3. Decisions already made — do not relitigate

**Cross-league identity is `auth_id` only. Never name matching.** Two people
called Bob are two people. Name matching caused a real data incident
(commit `74aac08`, the Charlie incident): `mergeDuplicatePlayers` ran on
every fresh device, silently merged anyone sharing a first name and rewrote
their match history onto whichever record it picked. It's now
`detectDuplicateNamedPlayers` — pure detection, zero mutation. A name match
may only ever become a *suggestion* a human explicitly confirms.

**`charlie` and `cheese` are two different people. Do not merge them.** In
Seacourt, `charlie` is Charlie Henry and `cheese` is Charlie Easey — John
Easey's son, who Sam has a long rivalry with. Charlie Henry's `nick` field
*also* says "Cheese", so the two rows look exactly like one person entered
twice: same first name, one nicknamed what the other is named. They are not.
This specific pair is what a previous session merged, and it is the incident
above. Never merge them, never propose merging them, and never treat two
similar-looking player rows as duplicates on your own judgement — ask.

`cheese` has no surname and no level set, which is why Charlie Easey shows
as unrated and sits below the rated players on the global table. That is a
data-entry gap, not a bug, and fixing it is Sam's call, not a cleanup to
perform unasked.

**Global rank treats level as a claim, not an anchor.** Level is a dropdown;
anyone can pick "Pro". So it's a starting assumption whose weight decays as
evidence arrives — an unbacked claim gets dragged towards the middle of the
scale, six matches against your own level or better halve the trust term,
eighteen quarter it. Evidence *replaces* the claim rather than adding to it.
All-time wins sit on a log curve so volume against weak opposition can't
outrank quality. Under 10 games you're **provisional** and pulled to the
middle — one match is not a position in a table. All of this is documented in
the long comment on `globalScore()` in `src/lib/globalTable.ts` — read it
before changing a coefficient.

**Unrated players are ranked with everyone else, on their record.** This
reverses an earlier rule that listed them separately underneath with no
place number. The intent had been to avoid assuming an unrated player was a
beginner, but the effect was worse than the assumption it avoided: it put
Charlie Easey's 6-3-10 below a player who was 0-0-1, and "below everybody"
is a stronger claim than "probably a beginner", not a weaker one. Someone
with no level now starts at `NEUTRAL` — the same middle a rated player's
unevidenced claim gets dragged to — and their results move them from there.
Their row still shows no level badge, so nobody is presented as having
claimed a level they haven't.

Known wrinkle, accepted rather than solved: setting no level scores slightly
higher than honestly setting Beginner/Low, because a low claim is
information and moves you down from the middle. It only affects provisional
players and evaporates once results accumulate. Don't "fix" it by guessing a
level for people.

**Margin counts, and so does a bad loss.** A scored quality match is worth
`(1 - W) * result + W * share`, where share is the fraction of games taken
and `W` is `MARGIN_WEIGHT` (0.35). A share rather than a games difference
because Rally covers several racket sports and 6-0, 11-0 squash and 21-0
badminton all have to mean the same thing. Losses to opponents *below* your
level pull you down, weighted by the gap and averaged over games played —
before this they counted for literally nothing, so losing to somebody
stronger cost you something while losing to a beginner cost you nothing.
Every weight lives in `globalTable.ts`, never in the SQL: the function
reports facts, the app decides what they're worth, and tuning needs no
migration. Matches with no score keep their plain result, so leaving the
score box empty costs nobody anything.

**Careers from before Rally existed belong in Legacy and trophies, not the
global table.** A peak the app never saw isn't something it can honestly
rank. Don't try to make the global table account for it.

**Destructive things take two steps, and the confirm states the number out
loud.** "Delete all 44 results in this league? Players are kept. This cannot
be undone." Sam lost a week of data once. Leaving a league is offered;
deleting a league is not.

**Match edits and deletes need agreement.** A participant proposes, the other
agrees, or a client-side sweep finalises after 24h of silence. Against a
shell opponent (no `auth_id`, nobody who could agree) it applies straight
away. Enforced in RLS as well as in the UI.

**Messages are Facebook-shaped.** Anyone can send a first message, but from a
stranger it lands as a *request* — the message arrives, the conversation
doesn't start until accepted. This matters because coaches will set up
leagues and leagues will contain juniors. The rule lives in RLS, not the
app: while a thread is pending only its starter can write to it.

---

## 4. How Sam likes to work

- **Typography is bold and iOS-like.** Body font leads with `-apple-system`
  so iOS renders SF Pro. `display` (Barlow Condensed) is for big page-level
  headings only.
- **Monospace is for NUMBERS ONLY.** Ratings, scores, dates, counters. Never
  words. A monospaced dropdown or search box reads as code — that has been
  fixed several times, don't reintroduce it.
- **No emoji as icons.** Draw an SVG in the app's own colours. A 🔔 renders
  as Apple's glossy 3D bell on iPhone and something else on Android, so it
  never matches the app. See `Bell.tsx` and `MessengerBird.tsx`.
- **Animation needs a reason.** The pigeon flaps while messages are unread
  and stops the moment the count clears. A permanently animating icon on a
  screen someone is reading is an irritation, not an alert.
- **A label nobody can decode is decoration.** "#6" is meaningless without
  the field size, so `standingWord()` turns rank-of-field into one word
  (Elite / Strong / Decent / Climbing / Early days). Spell out what a chip
  means next to it rather than hiding it behind a tap.
- **Commit and push as you go**, and say what you did in plain English.
  Commit messages here are prose that carries the *reasoning*, not a
  changelog line — read the last few for the register. They're the main
  reason this file could be written at all.
- Show before/after numbers before applying anything that shifts existing
  ratings.

---

## 5. Outstanding work

Approved, not built:

- **Trophies for unclaimed players.** A trophy should attach to a league
  player row, not just an account, so a club admin can record
  "Hugh — Seacourt Men's Singles 2019" against someone with no account, and
  it transfers when they claim. Needs a migration + a form.
- **Fancy loading screen on first app load.**
- **Head-to-Head** is missing the favourite % and needs simplifying.
- **Prompt everyone to re-pick their level** now six categories exist, so the
  empty Amateur and Semi-pro tiers fill by self-selection. This isn't only
  tidiness: it's also the repair for the one-off ELO shift the new scale
  caused, because the pairs that moved apart move back when the person
  between them takes up the new tier.
- **A "what's new" notification** listing recent updates.
  **ASK SAM BEFORE POSTING ANYTHING TO HIS LEAGUE — it goes to everyone.**

From Sam's original 13, still undone:

- ~~Items 1 + 2 + 8, the 18-point scale~~ — **done**. Six categories,
  `LV_FACTOR` deliberately unchanged at 0.45 (a category is 3 points wide on
  both scales, so a one-category-up win is worth exactly what it always
  was — refitting it was tried and is worse), win-quality divisor 4 → 6.2,
  `NEUTRAL` 3 → 6. Difficulty thresholds untouched, and *no rescale of them
  exists*: the proof is in the comment above `ratingForGap`. Sam's follow-up
  plan is to prompt everyone once to re-pick their level rather than
  reclassify anyone — self-selection, not admin edit.
- **Item 9, doubles** (~70% of Sam's club). `docs/doubles-readiness.md` is
  the written plan: keep doubles separate from singles rather than
  generalising `p1`/`p2` into arrays, and never fake a composite team
  player id. **Explain the options to Sam before building.**
- Items 7, 10, 11, 12, 13 — untouched.

---

## 6. Supabase

**Sam runs the SQL himself.** Write the file into `supabase/`, tell him it's
there, and let him paste it in. Don't try to apply migrations.

Already run: `schema_global_standings.sql`, `schema_messages.sql`,
`schema_level_val_18.sql`, `schema_global_standings_margin.sql`,
`schema_global_standings_badloss.sql` (that last one supersedes the margin
file — it contains everything that did, plus the bad-loss columns, so on a
fresh database run it alone).

`level_val()` in SQL is a hand-copy of `levelVal()` in `core/levels.ts`. If
`LEVELS` ever changes again this must change with it: `array_position`
returns NULL for a category it doesn't know, and a NULL level is excluded
from the quality filter entirely — so anyone picking a new category would
silently record zero quality games forever, with no error anywhere.

**Tell him before anything touches existing data.** Additive migrations
(new columns, new tables, widened policies) are fine to propose; anything
that rewrites or deletes rows gets flagged explicitly first.

Tables: `leagues`, `league_members`, `players`, `matches`, `fixtures`,
`posts`, `profiles`, `friends`, `clubs`, `club_members`, `trophies`,
`message_threads`, `messages`, `shared_storage`, `user_storage`.

Security-definer functions do the cross-boundary work: `global_standings()`
(aggregate-only, and only for people already visible to you — never another
league's matches, opponents, members or name), `start_thread()`,
`unread_message_count()`, `is_league_member()`, `is_club_admin()`,
`level_val()`.

`backups/` holds production snapshots with real player PII and is
gitignored. Never commit it, never paste its contents anywhere.

---

## 7. Known issues, not fixed

- **The Global table reads *current* level; the league reads level *at the
  time*.** `global_standings()` uses `players.level`, while `core/elo.ts`
  and `core/difficulty.ts` use `levelAt(player, matchDate)`. So the same
  match can be a quality win in one place and a bad loss in the other, and
  promoting somebody retroactively turns their old wins into bad losses on
  the global table only. Fixing it means teaching the SQL to resolve
  `level_history` per match, which it doesn't read at all today. Deferred
  deliberately until Sam has finished rewriting people's level histories —
  tuning it against the old picture would mean doing it twice.
- **Orphaned account rows.** A past glitch left people holding a login whose
  player row is a new empty one, while their real record sits on an
  unclaimed shell. `boot()` links by `auth_id` first, so they're sent
  straight to the empty row and never offered the claim screen — they can't
  reach their own results. Fix is to delete the *empty* row (check it has
  zero matches, reported, posts and fixtures first); their login survives,
  and next sign-in offers them the claim list so they pick their own record.
  Charlie Easey was one of these. There may be others: any `players` row
  with a non-null `auth_id` and zero matches is a candidate.

**Fixed, recorded so nobody reintroduces them:** `saveData` no longer leaves
the screen showing a change the database refused — on failure it re-reads
the league and shows what actually saved (not the pre-save state, since the
four syncs run together and some can land while others fail). The profile
difficulty bars no longer paint grey before players load: an unknown
opponent yields no colour rather than the *unrated* tier's real grey, and
`players` is in that memo's dependency list, without which the grey could
outlast the load entirely.

---

## 8. Gotchas worth knowing

- A `\u....` escape written in JSX *text* is a JavaScript escape, not a JSX
  one, so it renders as the literal characters. Bit us on seven chevrons
  that all showed on screen as the seven characters backslash-u-2-0-3-A
  rather than a chevron. Paste the real character instead.
- The season/all-time toggle persists per league. When it didn't, the table
  silently reverted to season-only after every deploy and long careers read
  as a handful of games.
- `computeStats` only counts a match when **both** players are in the list
  passed to it. That's load-bearing: narrowing the roster scopes the results
  for free, which is how the personal "Everyone I've played" view reuses the
  whole of `LeagueHome` without a second code path.
- League places on a profile come from running the same `rankMaps()` the
  table runs — never a second copy of the formula in SQL, which would drift
  and put a different number on the profile than on the table.
- Messages poll rather than use realtime: a few hundred bytes while the
  screen is open, and no extra Supabase setup.
- `?__dev_auto=1` fakes a session and mounts a debug league. Guarded to
  non-production so it can't become a login bypass on the live URL.

---

## 9. Before you touch the Global table — you cannot see it

The league table is computed in the app from data you can read. **The Global
table is not.** It comes from `global_standings()` running against live
Supabase data, and a coding session can read the code but cannot query the
database. If you change the ranking maths you are working blind.

On 2026-09-04 a session rebuilt that ranking three times in one evening,
every time against `backups/production-snapshot-2026-08-21.csv`. That file's
most recent match is **8 August**, it holds 16 players and 63 matches, and
nobody in it has a carried-in record. Live, Zaach is 32-0-12; in that file he
is 2-0-0. So every table it showed Sam disagreed with his app, and each fix
broke something else. Check the date on that backup before trusting it.

Ask Sam to run this and paste the output before changing any ranking:

```sql
select case when m.winner = 'p1' then p1.name || ' ' || coalesce(p1.last,'')
            else p2.name || ' ' || coalesce(p2.last,'') end as winner,
       case when m.winner = 'p1' then p2.name || ' ' || coalesce(p2.last,'')
            else p1.name || ' ' || coalesce(p1.last,'') end as loser,
       count(*) as times
from public.matches m
join public.players p1 on p1.id = m.p1
join public.players p2 on p2.id = m.p2
where m.status = 'confirmed' and m.winner <> 'draw'
group by 1, 2 order by 3 desc;
```

That turns the whole thing into arithmetic instead of guesswork.

**Two SQL files are deliberately un-run. Leave them unless Sam asks.**

- `schema_global_standings_perf.sql` — dead. The code that read it was
  reverted in 7b1e307.
- `schema_global_edges.sql` — **live code reads this.** Running it switches
  the Global table to the network rating in `core/rating.ts`. That has ten
  passing unit tests but has never run against real data. Without it the
  RPC fails and the table falls back to the previous maths, which is the
  state Sam is on and is happy with.

**The complaint that started it all was narrow**: Zaach beat Sam twice and
ranked below him. That wants a head-to-head tiebreak between players who are
close on score — not a new architecture. Three were attempted; none was
needed.
