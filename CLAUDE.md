# Rally — working notes for Claude

Head-to-head rankings for racket sports. Real app, real users, real data:
Sam's club (Seacourt) plus a few others are live in it. Treat production
data as sacred — see **The Charlie incident** in §3 for why.

**On screen the top level is a "club" since winter-pilot (2026-10-21)** — "Run
your club", "Club settings". UI text only: the tables, `leagueId`,
`?league=friendly` and every key still say league, and "League" is still the
competition FORMAT (vs knockout). The trophy screen is "Trophies & honours".

**The app is called SOUTHWOOD since 2026-09-27** (Sam's company is
Southwood HT Ltd). "Rally" was taken several times over — the LTA's own
booking service among them. Every user-facing string, the manifest, the
page title and the icon (an S with the ball, same stroke as the old R) were
changed; code identifiers (`RallyApp`, `RallyMark`), storage keys
(`rally.*`) and the default theme's id (`rally`, in a DB check constraint)
deliberately were not, because renaming them changes nothing on screen and
the keys would lose everybody's saved preferences. Say "Southwood" to Sam.

Read this before touching anything. It exists so you don't have to
re-derive the reasoning from the commit log every session.

---

## 1. The shape of the thing

| | |
|---|---|
| Stack | Next.js 14 (app router) · TypeScript · Tailwind · Supabase |
| Repo | `Southwoodht/Rally-` on GitHub, branch `master` |
| Deploy | Vercel, auto-deploys from `master`. **A push is a deploy.** |
| Rollback | **branch `rollback/pre-home-columns-2026-10-24`** (94f5896) is master just before Home went two columns on laptops; **`rollback/pre-cream-2026-10-24`** (ad5aa9f) is master just before the cream, brass and ink Southwood theme became the default again; **`rollback/pre-laptop-2026-10-24`** (0abb1c3) is master just before the laptop layout (sidebar, wider column; CSS at the foot of globals.css); **`rollback/pre-icon-2026-10-24`** (379fcd1) is master just before Sam's new icon (cream, gold rim, Fraunces Bold S at opsz 144, gold ball), the icon-matched loading screen and Log out in the menu; **`rollback/pre-glitch-fixes-2026-10-24`** (0792ac6) is master just before the sheet-position, season-flash and in-app profile fixes; **`rollback/pre-grouped-2026-10-24`** (6bfe1f5) is master just before the inset-grouped restyle (division odds, season planner, head-to-head, division tables with promotion/relegation zones, club sheet summaries; pieces in `ui/Grouped.tsx`); **`rollback/pre-landing-2026-10-24`** (f6d6b0c) is master just before the landing page from Sam's mockup and bolder type there; **`rollback/pre-coach-cleanup-2026-10-24`** (40ba7e3) is master just before moderation, the club sheet, London default and the privacy page; **`rollback/pre-fixed-header-2026-10-24`** is master just before the one shared top row; **`rollback/pre-header-2026-10-24`** is master just before the club/theme row left Table, Fixtures and Add result; **`rollback/pre-odds-unplayed-2026-10-24`** (3b862be) is master just before unplayed players were seeded from their level in the odds; **`rollback/pre-odds-rd-2026-10-24`** (d1b9953) is master just before division odds used the ±; **`rollback/pre-fixes-2026-10-24`** (b08447e) is master just before the wins-colour, Compare and mixer-court fixes; **`rollback/pre-div-odds-2026-10-24`** (5220b63) is master just before division predictions and the Fixtures tidy; **`rollback/pre-rallio-2026-10-23`** (ac654e0) is master just before the mixer, Clubhouse TV and fixture messaging; **`rollback/pre-fixes-2026-10-23`** (59f6e9e) is master just before the multi-division prompt, dated division rows and the trophies card fix; **`rollback/pre-organiser-edit-2026-10-23`** (751cec4) is master just before shell-match editing and the per-division Fill fix; **`rollback/pre-division-dates-2026-10-23`** (cebe8b7) is master just before per-division dates; **`rollback/pre-polish-2026-10-22`** (9cd4b4b) is master just before the motion layer and sentence-case labels; **`rollback/pre-profile-places-2026-10-22`** (fb73560) is master just before profile places moved to Glicko; **`rollback/pre-divmanage-2026-10-22`** (4eaea3e) is master just before division settings; **`rollback/pre-awards-2026-10-22`** (4304fbb) is master just before season awards and the next-season planner; **`rollback/pre-divisions-2026-10-22`** is master just before Divisions; **`rollback/pre-ladder-2026-10-22`** (76a172c) is master just before the singles ladder; **`rollback/pre-tour-2026-10-22`** (a7bcf99) is master just before the tour; **`rollback/pre-one-table-2026-10-22`** (72d0371) is master just before the one-ranking Table; **`rollback/pre-glicko-2026-10-22`** (6b136c4) is master just before Glicko and score-free ratings merged; **`rollback/pre-emails-2026-10-22`** (bbf40a5) is master just before emails merged; **`rollback/pre-phase2-2026-10-22`** (76b0036) is master just before winter Phase 2 merged; **`rollback/pre-winter-2026-10-21`** (aa8d516) is master just before winter-pilot merged — tag pushes are refused from cloud sessions, so it is a branch. Older tags: **`rally-pre-holiday-2026-09-12`** is the most recent known-good (also `v1.1-global-table`, `rally-golden-2026-08-15`, `rally-pre-deployment-2026-08-19`) |
| Dev server | `npm run dev` → :3000, or the `rally-dev` config in `.claude/launch.json` |
| Checks | `npx tsc --noEmit`, `npm run test:core`, `npm run check:sql`, `npm run build` |

There is no CI. The build passing locally is the only gate before a push
becomes a live deploy, so run it — and **read its exit code**, not its
output. `npm run build | grep` returns 0 when grep matches the words "Build
error occurred", which has waved a broken build through twice.

`npm run test:core` runs `src/core/tiebreak.test.ts` — plain TypeScript with
an assert, compiled by `tsconfig.test.json` and run by node. No framework:
the tests import relatively because tsc does not rewrite path aliases on
emit, so an `@/core/...` import compiles and then fails at run time.

Two build failures on this machine were environmental, not code. `EINVAL
readlink .next/...` means the dev server is running and holding the
directory `next build` wants to clear — stop the preview first. `ENOSPC`
means the disk is full, which it has genuinely been.

**The repo lives at `C:dev
ally`, and deliberately not in OneDrive.** It
was moved there on 2026-09-10. OneDrive was syncing `node_modules` and
`.next` — `.gitignore` means nothing to it — which made every build slow and
kept a few hundred megabytes of regenerable junk permanently on a nearly full
disk. `.next/cache` alone regrows to ~100MB per build, so **clear `.next`
after a build gate** rather than leaving it sitting there. If a session's
preview server reports `'next' is not recognized`, it is pointed at the old
OneDrive path, which no longer has `node_modules`; reopen on `C:dev
ally`.

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
  or `"YYYY-MM"`; `monthIndex()` normalises both. `sealTimeline()` turns a
  list of starts into from/to periods — the repair screen collects
  "effective from" only, because people know when they moved up and not
  when the old level stopped, and asking twice is how a timeline ends up
  with a hole in it. `levelNow(player)` is the present-tense lookup: a
  prediction about a match nobody has played is asking about today, which
  is the one date the current claim is evidence for.
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
- `tiebreak.ts` — who is above whom when the metric ties. Head-to-head is
  computed **within the tied group**, never pairwise: pairwise is not
  transitive, and a JS comparator built on it returns different answers
  depending on which pairs the sort examines. Criteria re-apply from the top
  inside every subgroup a split produces (the UEFA rule). Name orders but
  never ranks — if it separated ranks nobody could ever share one and the
  3, 3, 5 convention would be dead code. Tested.
- `rankDisplay.ts` — `ratingColumn()`. Whole numbers until two **neighbours**
  round the same, then one decimal for that pair only, and never when the
  decimal would print the same digits on both. Tested.
- `stars.ts` — `starsForLevel()` is `(levelVal + 1) / 3`: one star per tier,
  filled in thirds by sub-level. **Six stars**, because six tiers times three
  subs is eighteen grades and six stars times three thirds is eighteen
  positions — an exact fit, nothing collides. Also `TIER_HEIGHTS` for the
  profile form bars.
- `snapshots.ts` — weekly rank snapshots, because standings are a full
  recompute over all history and the past is not recoverable from the
  present. Movement has to be remembered, not derived.
- `feedContext.ts` — the phrase on a scoreline card ("3rd straight"), true as
  of that match rather than as of now.
- `matchGrade.ts` — how good a result was, given who it was against.
  **Categories only, never sub-levels**: level is a dropdown and half of
  them are wrong, so ranking Intermediate/High above Intermediate/Medium is
  arithmetic performed on a guess. The 18-point scale stays in the ratings,
  where the error averages out over a hundred matches; it is wrong for a
  label on one row. `gradeAgainstHistory` returns `then` and `now`, and
  **`now` is null whenever it equals `then`** so no screen can render two
  identical chips. Verdict thresholds are 65/40/20. Tested.
- `matchQuality.ts` — everything the matches screen shows, from one pass.
  Quality and History are two presentations of it, so they cannot disagree.
  Pending matches are excluded like everywhere else, and an ungraded match
  is counted in **neither** bucket — see §11. Tested.
- `rating.ts` — the network rating behind the Global table. See §9.
- Also: `predict.ts`, `season.ts`, `legacy.ts`, `achievements.ts`,
  `rivalries.ts` (`topRivalries()` scores by meetings x closeness x recency,
  and returns fewer than three rather than padding), `memories.ts`,
  `notifications.ts`.

`computeStats` also returns `ratingBefore` — what each player was rated
walking on court, per match. It exists because that loop is the only place
the number lives; afterwards there is just the final rating, and answering
"what was he worth in 2019" otherwise means replaying everything per
question. Best wins are ranked on it.

**`levelAt()` returns null when nothing was recorded, and that is
load-bearing.** It used to fall back to the player's level today, which
reached much further than it looked: fourteen of Seacourt's twenty-one
players have no history, so twenty-six of Sam's forty-four matches were
graded against a level nobody ever claimed for the year they were played —
and because the fallback read the *current* claim, promoting somebody today
silently rewrote what their 2019 wins had been worth. `levelAtRecorded()`
was the no-fallback variant and has merged into `levelAt`.

**`?? 0` is not handling that null.** Zero is Beginner/Low, a claim in its
own right and a much stronger one than saying nothing; seven call sites were
doing exactly that, so removing the fallback on its own would have quietly
regraded fourteen players as beginners. Sam's ruling on 2026-09-06 is **no
adjustment** — with a level missing the level term drops out rather than
being guessed. `elo.ts` keeps its multiplier at 1 (a gap needs two ends),
`official.ts` uses opponent quality 1, best-wins ordering in `legacy`,
`season` and Compare falls back to Elo alone, and `events.tsx` emits no
upset event because there is no verifiable gap. Three call sites were never
date queries at all — predict and Compare pass `Date.now()` — and they call
`levelNow()` instead, unchanged in behaviour.

Before/after is in the commit message for `befc7d2`, measured on the stale
August snapshot so read the direction and not the magnitudes: Official's
top three reorder and nothing else moves, while Elo moves a lot and the
right way. Charlie Easey goes from **+92.2 to −31.9** on a 6-3-10 record,
because he has no level at all and the old `?? 0` had been scoring him as a
beginner beating his betters. **The app was rewarding having no level.**

Known wobble, accepted: best wins order by `(level + upset) * 1000 + Elo`,
so a recorded opponent outranks an unrecorded one whatever their Elo. It
disappears as histories fill in, which is what the repair screen is for —
**Profile → menu → Level history**, badged with how many active players
still have none. Nothing caches a grade: no tier or colour is written by
`leagueData.ts` or `storage.ts`, and both consumers are memos with
`players` in the dependency list, so setting a history retroactively
regrades every past match on the next render.

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
- `invite.ts` — invite links, added 2026-09-11. There is **no invites
  table**: a link is the league's existing six-character join code in a URL
  (`?join=WDZDTQ`), redeemed through the same `joinLeague()` the typed form
  uses. Building a second system alongside a working one is how the two come
  to disagree. The code is stashed in `localStorage` across sign-up, because
  an email round trip eats the query string and the signed-out visitor is
  who the link is mostly for; it is stripped from the address bar once read,
  so a reload can't re-run a join. **No expiry and no single use** — the join
  code is read out loud in clubhouses, so a link gives away nothing the
  current flow doesn't. Real expiry needs a real table.
- `format.ts` — also `formatMatchDateTime`, the one way an upcoming match
  says when it is: "Sat 12 Sep 2026 · 2:00pm", **always Europe/London**. A
  club plays where the club is, so somebody checking fixtures from a hotel in
  Spain should read the time they will turn up at, not that time shifted an
  hour. `formatMatchDate` is the same vocabulary without a time nobody
  recorded. Every screen showing a booking uses these — before them, Fixtures
  had grown its own formatter and Coming up rendered the stored value raw.
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
outrank quality. Under `PROVISIONAL_GAMES` (5) you're **provisional** and pulled to the
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
`MARGIN_WEIGHT` lives in **`core/constants.ts`** next to `K` and
`LV_FACTOR`. It moved out of `globalTable.ts` on 2026-09-05 when league ELO
started using it too — one weight in two files is a weight that will quietly
disagree with itself. Never in the SQL: the database reports facts, the app
decides what they're worth, and tuning needs no migration. Matches with no
score keep their plain result, so leaving the score box empty costs nobody
anything.

**Both ratings read the score, and neither did until 2026-09-05.** League ELO
never had. The Global table's margin weighting was live but went dead the
moment `global_edges()` was run the day before: the network rating replaces
the score outright and the edges were bare 1/0.5/0, so `globalScore()` was
computing margins nothing then read. The lesson generalises — when you change
what an RPC returns, check what downstream stops reading.

Known and unresolved: **the formula can only take away.** A 6-0 win is worth
a plain win and every other win is worth less, so it punishes a narrow win
rather than rewarding a dominant one. Sam's own examples all wanted exactly
that — 7-6 is a bad win, 6-5 is a good loss — but he has never ruled on
whether a thrashing should actively pay more. Don't assume either way.

**Finishing a fixture and logging a result follow the same agreement rule.**
`resolveFixture` used to hardcode `status: "confirmed"`, so completing a
fixture against somebody with an account force-confirmed a result they had
never seen — straight past the rule the rest of the app enforces. It now runs
the same test Log a result always has: the other participant having an
`auth_id` means they agree first. Where league staff fill in a result for two
other people, **either** of them having an account is enough to wait, which is
stricter than the participant case on purpose — neither of them has said a
word about it.

**A name match may become a suggestion and never a decision — and the check
is wider than exact.** `PlayerPicker.findLikeness` matches on first name,
full name or nickname, all case-blind, because the duplicate people actually
create is "Charlie" when Charlie Henry already exists: a surname typed once
and forgotten walks straight past an exact-match check. It only ever asks
("Did you mean Charlie Henry?"). Nothing merges and nothing is chosen
automatically — see the Charlie incident above for why that line is drawn
where it is.

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
- **Numbers are the body font with `tabular` figures, not monospace.** This
  replaced the old "monospace for numbers only" rule on 2026-09-06, when the
  whole app moved onto the scoreboard system (§10). JetBrains Mono reads as
  code beside that palette; `fontVariantNumeric: "tabular-nums"` gives the
  column alignment that was the point of using mono in the first place. The
  half of the old rule that still stands, and stands harder: **never set
  words in the numbers font.** An uppercase mono label reads as a code, not
  as something you can tap.
- **No emoji as icons**, and as of 2026-09-11 there are none left in the UI.
  Draw an SVG in the app's own colours. A 🔔 renders as Apple's glossy 3D
  bell on iPhone and something else on Android, so it never matches the app.
  See `Bell.tsx` and `Robin.tsx`.
  `components/ui/Glyph.tsx` maps every legacy glyph string to a drawn lucide
  icon. It exists because `core/achievements.ts` and `core/notifications.ts`
  label themselves with a character, and core should not know what a screen
  looks like — so the translation happens at the point of drawing and their
  strings stay as they are. **If you add an icon key in core, add it to the
  map**: an unrecognised glyph draws nothing, deliberately, because a wrong
  icon is worse than none and a gap gets reported.
  Still emoji, and known: `theme.ts AVATARS` and therefore every player
  avatar. Fixing it needs a drawn set, a change to `Avatar`, **and** a
  migration, because existing players have the character stored on their row
  and changing only the picker splits a club between two styles.
- **The unread count is robins, not a number.** `MessageRobins.tsx`: one bird
  per unread up to three, and below four the birds *are* the badge — a dot
  beside three robins says the same number twice. Robins because Victorian
  postmen were nicknamed robins after their red uniforms, which is why robins
  deliver the letters on Christmas cards; the red breast is also the only
  feature that survives at 20px. The fly-in fires **only when a poll sees the
  count rise while the app is open** — never on mount, never on a tab switch.
  The header unmounts when you open Messages, so the "last count animated
  for" is module state rather than component state, or the whole flock
  re-lands on every navigation and the charm is gone in a day.
  `MessengerBird.tsx` (the pigeon) is no longer used anywhere but is kept
  rather than deleted.
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
- **Look at the screen.** Reasoning about data flow found the filter
  correct and missed that its result appeared eight hundred pixels below the
  tap. Rendering the real component with real data has caught, in one day: a
  rating bar at 100% for everybody (a -1,000,000 sentinel dragging the
  scale), a bar invisible at 1.14:1, a column of "0.0", a form bar
  fabricating a level, and a lime ring that vanished on the one player it
  existed to mark. None of those were visible in the code.
- Sam reads on a phone, between other things. Answer first, detail only if
  it changes what he does.

---

## 5. Outstanding work

Built and live:

- ~~Trophies for unclaimed players~~ — **done, migration run 2026-09-04.**
  `trophies.player_id` attaches an honour to a league player row instead of
  an account, so a club admin can record "Hugh — Seacourt Men's Singles 2019"
  against somebody who has never opened Rally. Nothing rewrites the row when
  Hugh claims the player: the profile reads trophies for *this player row or
  this auth id*, so setting `players.auth_id` is the whole of the transfer.
  Recording lands `approved` with the admin stamped on it — they are the
  review — and RLS only allows it against a player row with `auth_id` null,
  so it can never write onto a live account behind its owner's back.
  The club admin tab lists every player in the club with a control to record
  an honour against them; a trophy can be worth points, at the admin's
  discretion, and an owner can take down one of their own.

- **Import old results — built 2026-09-27, no migration.** Run your league →
  Import old results. Paste from a spreadsheet, notes or a group chat;
  `core/importResults.ts` (tested) reads it, then three steps: names, check,
  add. **A written name is linked to a player automatically only when nobody
  else could be meant** — "Charlie Henry" still asks in Seacourt, because
  another Charlie exists. Results land `confirmed`, like Bulk / history.
  It replaced a Data-page button that imported `lib/historyImport.ts`'s
  hard-coded list of Sam's own Seacourt matches into whichever league pressed
  it. That file is now only used for `normalizePlayerName`; its data is dead.
  New rows in `syncEntity` are now inserted in batches of 100
  (`defaultToNull: false`) rather than one request each.

Left partial by the 10 Sep brief (`RALLY_FIX_BRIEF.md`, written up in
`RALLY_FIX_REPORT.md`):

- **Cancelling a match doesn't tell the opponent.** Cancel deletes the
  fixture, so there is nothing left to notify from, and notifications are
  assembled in `core/`. Doing it properly is three things that must land
  together: an additive migration adding `cancelled_at` / `cancelled_by` to
  fixtures, the code keeping the row and filtering it out everywhere, and the
  inbox item built in `NotificationBell` (a component, so allowed). The
  middle one breaks Cancel until the SQL is run, which is why it wasn't
  started.
- **Home cannot run without a league.** `RallyApp` takes a `leagueId` and
  reads that league on mount, so Dashboard's `else setView("empty")` is not a
  guard to delete — it is the only branch there is. Running league-less is a
  boot-path change for every user. The no-league screen itself was rebuilt;
  the rest wasn't, and shouldn't be attempted without a working preview.
  This is also what blocks Friendlies: `league_id` null is allowed by the
  schema and handled in `core/booking.ts`, but no UI can reach it.

Approved, not built:

- ~~**The nudge**~~ — **built 2026-09-11, needs `schema_match_nudge.sql` run.**
  The limit is enforced in `nudge_match()`, a security-definer function, and
  **not** in RLS: permissive policies for one command are OR'd, so an extra
  UPDATE policy on `matches` would have widened access rather than narrowed
  it and handed the reporter every column on a pending match. `nudged_at` is
  read back in `rowToMatch` and deliberately not written by `matchToRow`, so
  an unrelated save cannot reset somebody's 24 hours. Original spec follows.

- **The nudge.** A pending result sits there until the opponent confirms it,
  and there is currently no way to ask them. Designed with Sam and specified
  down to the detail: delivery goes through the existing message system, but
  the **source of truth is a `nudged_at` timestamp on the match**, not the
  message — a message can be deleted, and then the app has forgotten
  something it needs to know. One nudge per pending result per 24h, and the
  limit is **enforced in RLS, not by disabling a button**: a disabled button
  is a suggestion. The button then reads "Nudged 2h ago". One added column.
- **Fancy loading screen on first app load.**
- ~~**Head-to-Head** is missing the favourite %~~ — **it isn't, and hasn't
  been since the scoreboard rollout.** "Predicted win" shows both
  percentages, a bar and a sentence naming the favourite and why. Verified
  against fixture data on 2026-09-11. The "needs simplifying" half is
  unactioned: the screen is dense but organised, and nobody has said what
  specifically is wrong with it.
- ~~**Prompt everyone to re-pick their level**~~ — **done 2026-09-11.**
  `home/LevelRecheck.tsx`, shown once on Home. The flag is in `user_storage`
  (`levelRecheck.v6`), not on the player row: it is a fact about the person's
  relationship with the app, and it needs no migration. Declining counts as
  being asked, and a failed read is treated as asked, so a network hiccup
  cannot resurrect the card.
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

**The schema is in this repo. Read it before writing SQL.**
`supabase/schema.sql` and `supabase/schema_players_matches.sql` contain the
actual `create table` statements — every column, with its type and default.

This is written in capitals because not reading them cost Sam an evening on
2026-09-11. A session inferred the columns of `players` from `playerToRow`
in `leagueData.ts`, saw no `updated_at`, declared the column invented and
"fixed" working SQL to avoid it. `players.updated_at` exists — it is
`timestamptz not null default now()`, which is exactly *why* the app never
writes it and why it is absent from the mapper. **A column missing from a row
mapper is evidence about the app, not about the database.**

`npm run check:sql` now guards this. It builds the known schema from the
`create table` statements plus every `add column` in `supabase/`, plus the
row mappers, and flags any qualified column reference with no evidence behind
it. It is in the gate. An unknown column is a prompt to go and verify, not
proof of a bug — if it is real, add it to `EXTRA_COLUMNS` in the script.

**Two ways Postgres will let bad SQL through, both seen the same day.**
`create or replace function` checks plpgsql *syntax* and not table names, so
a function naming a column that does not exist is created successfully and
fails only when called. And every name in `returns table (...)` is also a
variable inside the body, so an unqualified column of the same name raises
"column reference is ambiguous" — again only at call time. The second one is
why `public_player_card()` carries `#variable_conflict use_column`.

Already run: `schema_global_standings.sql`, `schema_messages.sql`,
`schema_level_val_18.sql`, `schema_global_standings_margin.sql`,
`schema_global_standings_badloss.sql` (that last one supersedes the margin
file — it contains everything that did, plus the bad-loss columns, so on a
fresh database run it alone).

Also run on 2026-09-04, all four: `schema_clubs_trophies.sql`,
`schema_trophies_unclaimed.sql`, `schema_trophies_owner_delete.sql` (one
policy, so you can take down a trophy of your own) and
**`schema_global_edges.sql`** — see §9, that last one changed the Global
table.

The first of those had **never** been run until that day, though the code
reading it shipped long before — clubs, club_members and trophies didn't
exist in production at all, so the Claim-a-trophy form and the Club admin
tab were inert from the day they were written. Every call sits inside a
catch, so they failed silently instead of saying so. **A file in
`supabase/` is not run just because the feature reading it is deployed**,
and a screen that shows you nothing is not the same as a screen with
nothing to show.

The second added `trophies.player_id` — a `text` column, because
`players.id` is the app's own short id and not a uuid. That mismatch is
easy to make: every other reference in `trophies` points at `auth.users`
or `clubs` and so is a uuid.

`level_val()` in SQL is a hand-copy of `levelVal()` in `core/levels.ts`. If
`LEVELS` ever changes again this must change with it: `array_position`
returns NULL for a category it doesn't know, and a NULL level is excluded
from the quality filter entirely — so anyone picking a new category would
silently record zero quality games forever, with no error anywhere.

Run on 2026-09-05: `schema_global_edges_score.sql`, which added the match
score to `global_edges()` so the Global table can see margin. It drops and
recreates rather than replacing, because the return type changed.

**And no `auth.uid()` in a diagnostic, ever.** In the SQL editor you are the
service role, so `auth.uid()` is null and anything resting on it matches
nothing — reported as "Success. No rows returned", which reads exactly like an
empty table rather than like a broken query. This is already written down for
`global_edges()` below and for `set_player_level_estimate`, and a query
filtering on "leagues I am in" was still written and sent on 2026-09-20. It
cost a round trip and told Sam nothing.

A diagnostic Sam runs is running as the service role against his own database.
It should select everything and let him find his row, not try to scope itself
to him.

**One query per file when you want an answer back.** The Supabase SQL editor
displays the result of the **last statement only**. A file ending in two
selects shows the second and silently hides the first, and what comes back is
a real answer to a question nobody asked. This cost two round trips on
2026-09-20 — the function-grants check and the level-state check — with the
same symptom both times: Sam pasted the duplicates table when the per-player
table was the one that mattered.

A migration can end with one verification select. A diagnostic should contain
exactly one statement.

**`global_edges()` returns zero rows in the Supabase SQL editor, and that is
correct.** It filters through `is_league_member()`, which reads
`auth.uid()` — and in the editor you are the service role, so nobody is
visible and you get nothing. Don't debug it from there. To check it's
installed, ask for its signature instead:

```sql
select pg_get_function_result(oid) from pg_proc where proname = 'global_edges';
```

The real test is the app: if the Global table still shows the network
ordering, the RPC is being called. If it had failed, the code falls back to
the old maths and the order visibly changes.

**Run on 2026-09-11: `schema_fixture_delete_participants.sql`.** One policy,
no data touched. DELETE on fixtures had been staff-only, which was fine when
only an owner could generate a season and stopped being fine once anybody
could book a match. **Cancel match therefore works for the two people in a
fixture as well as for league staff** — that is live, not pending. It drops
and recreates by name, so it is safe to re-run.

**Run on 2026-09-11, all three:** `schema_message_images.sql` (one nullable
`image_url` on messages), `schema_match_nudge.sql` (`nudged_at` /
`nudged_by` plus `nudge_match()`) and `schema_public_player_card.sql`.

`schema_public_player_card.sql` was re-run on **2026-09-12** with two
corrections: `recent` returns 100 matches rather than 10, so a profile can
compute form, win rate and streaks rather than only listing a few; and the
opening $$ of its body had been mangled to a single $ (see §8).

That last one is the one to know about. It backfilled existing league photos
into `profiles.avatar_url` — only where empty, so nothing was overwritten —
and added `public_player_card()` and `search_player_accounts()`.

**It deliberately relaxes the rule stated above about `global_standings()`.**
Any signed-in account can now read any player's record, form, recent matches
*and the names of their opponents*, in any league. Sam chose the full version
on 2026-09-11 having been shown the narrower one (record and form only, no
opponent names). Do not treat the old "never another league's matches,
opponents, members or name" line as still true of profiles — it holds for
`global_standings()` and no longer for `public_player_card()`.

`search_player_accounts()` returns account ids rather than rows, so what can
be *found* widened without what can be *read* widening.

**That paragraph used to say both functions were granted to `authenticated`
only, never `anon`. That was true of the file and false of the database.**
Checked on 2026-09-20: `has_function_privilege('anon', …, 'execute')` came
back **true** for `public_player_card`. Postgres grants EXECUTE on a new
function to PUBLIC by default and the file's `revoke` sits thirty lines after
the `create`, so a paste that stops early — or any run from before the revoke
was added — leaves it open, with no error and nothing visible on screen.
`supabase/fix_profile_function_grants.sql` closes it and re-reports.

The lesson generalises past this one function: **a grant written in a file is
not a grant in the database.** The same day's check on `public.profiles`
asked that question about a table and got a clean answer, which is probably
why nobody thought to ask it about the functions. Ask about both.

**Settled on 2026-09-20, after three rounds.** Every security-definer function
is now closed to `anon` except two, and those two are closed to nobody on
purpose:

| function | anon | why |
|---|---|---|
| `public_player_card`, `search_player_accounts` | no | the real exposure — records and opponents' names, readable signed out |
| `global_standings`, `global_edges`, `level_val`, `nudge_match` | no | never leaked; they filter on `auth.uid()` and returned nothing |
| `start_thread`, `unread_message_count` | no | never leaked; `start_thread` raises "Not signed in." on its first line |
| **`is_league_member`, `is_club_admin`** | **YES, leave it** | see below |

**Do not revoke `anon` from `is_league_member` or `is_club_admin`.** They are
not entry points, they are the predicates inside the row policies —
`is_league_member` alone appears in **fourteen** `using` / `with check`
clauses across players, matches, fixtures and posts. A policy's function call
is made by the *querying* role, so revoking execute does not make those
policies evaluate false for a signed-out request; it makes them **raise a
permission error**, and every signed-out query against those tables starts
failing instead of returning no rows. There is also nothing to close: both are
security definer, both resolve `auth.uid()`, and both answer a question about
the caller — "am I in this league" — which signed out is false and reveals
nothing. This is the exception to "revoke anon from everything", and it is the
kind of exception that takes the app down when applied by pattern.

**Why six were open at all, and it is not what it looked like.** Every one of
those files ends with `revoke all on function ... from public`. Those lines
ran. They did nothing.

Supabase ships `alter default privileges in schema public grant all on
functions to anon, authenticated, service_role`. A new function is therefore
granted to `anon` **directly**, not through PUBLIC — so revoking PUBLIC
removes a grant that was never the one carrying the access, succeeds, and
leaves `anon` exactly where it was. The three fix files worked only because
they said `from public, anon`.

**So the rule for every new function is `revoke ... from public, anon`,
explicitly — and `supabase/fix_function_grants.sql` is the one file that does
it for all of them.** Run it after ANY migration, every time. It is idempotent
and it skips functions that do not exist yet, so it costs nothing when nothing
is wrong. This matters more than it sounds: `create or replace` and
drop-and-recreate both count as newly created, so **re-running
schema_public_player_card.sql re-opens two functions every single time**. A file that revokes only from `public` ships the function open,
with no error and nothing on screen to notice. This was proved on 2026-09-20
by creating `public_league_snapshot` from a file carrying the public-only
revoke and watching the verification select in the same paste report
`anon_may_call = true`.

An earlier version of this note blamed truncated pastes — four files carrying
a revoke that had not taken effect looked like scripts dying before the end.
**Withdrawn.** The revokes ran; they were the wrong revokes. The one thing
that genuinely had never been created was `public_league_snapshot`, and that
was a separate matter.

### Run on 2026-09-12, both

`schema_public_player_card.sql` (re-run, dropped and recreated because the
return type had gained `age`, `level_history` and the h2h columns) and
**`schema_friendly_players.sql`**.

That second one is the one to know about. **`players.league_id` is no longer
`not null`** — a player row can exist outside any league, which is what makes
a Friendly possible. `created_by` was added so a league-less shell has an
owner, since there is no club to appeal to about one; league rows leave it
null and are governed by the league policies exactly as before. The read and
insert policies were rewritten and are byte-identical for league rows; every
new clause is gated on `league_id is null`.

**So "a player belongs to a league" is no longer an invariant.** Anything
that assumes `players.league_id` is present needs to cope with null.

### Previously waiting, now historical

Sam is away. **Nothing here breaks the app if it is never run** — each one
turns something on, and the code degrades with an explanation rather than an
error. Do not rewrite these files while they are pending; he has the text.

1. **`schema_public_player_card.sql`** — needs re-running. It has been run
   twice already, and has since gained `age`, `level_history`,
   `opponent_id` and `opponent_avatar`, and the recent-match limit went from
   10 to 100 (which is what makes best-streak correct). Without the re-run a
   public profile simply shows less.
2. **`schema_friendly_players.sql`** — matches outside a league. Drops the
   `not null` on `players.league_id`, adds `created_by`, and adds policies
   for league-less rows. Until it runs, the "Just me and my mates" button
   shows a screen naming the file and saying leagues are unaffected — which
   they are.
3. **`schema_match_delete_shell_and_pending.sql`** — the long-standing one
   below.

**Answered on 2026-09-20: `public.profiles` is not readable by `anon`.**
Sam ran the policy query and it returns two policies — `any signed in user
can search profiles` on select, qualified `auth.uid() IS NOT NULL`, and
`edit your own profile` on update, qualified `id = auth.uid()`. An
unauthenticated request has no `auth.uid()`, so it matches nothing. Names
and photos need an account to see. The question is closed; don’t re-open it
without a reason.

**Run on 2026-09-24: `schema_profile_theme.sql`** (branch `theme/picker`).
One additive column, `profiles.theme text not null default 'rally'`, plus a
check constraint naming the five themes. Verified: the column is there with
that default, and the two existing policies are unchanged — select qualified
`auth.uid() IS NOT NULL`, update qualified `id = auth.uid()`, which is exactly
the rule the column needs, so nothing was widened.

**The five theme names are duplicated in that constraint and cannot not be.**
`src/lib/themes.ts` is the list the app reads and SQL cannot import it, so a
sixth theme must change both — otherwise the write fails on the constraint and
the theme simply appears to "not save", with nothing on screen to explain it.

A lesson from this one, worth more than the migration: **the verification
select at the foot of that file checked the RLS policies, which is the part
that needed no change, and not the column, which is the part that did.** It
would have returned the same two rows from a paste that died before the
`add column`. A migration's closing select should prove the thing the
migration did.

**Run on 2026-09-26/27, all verified from their closing selects:**
`schema_doubles_fixtures.sql` (1, 11, 4, 1), `schema_doubles_unknown_scoreless.sql`
(an empty second seat and a result with no score), `schema_doubles_competitions.sql`
(2, 4, 4, 1) and `schema_singles_competitions.sql` (1, YES, 2, 1), with the grants
sweep after the two that created or recreated a function. Seacourt has
`doubles_enabled` and `competitions_enabled` on. Both flags can now be switched
from Run your league → League settings, by the league's CREATOR only — the
leagues UPDATE policy is `created_by = auth.uid()`, not the owner role.

**Run on 2026-10-14, verified (true, 1, 0, 1): `schema_trophies_award_any.sql`.** A club
admin may award a trophy to ANY player in a league they are in, not only
unclaimed rows, and a player may remove one recorded against their own row —
that removal is the safeguard that replaced "no account". Had it not run,
the Give a trophy form would have said so on somebody with an account.
Also found the same day: the scoreboard Profile rewrite had dropped
`VerifiedTrophies` (still in the repo, rendered nowhere), so admins had no
Record button anywhere. Give/remove now live on `VerifiedTrophiesRow`.

**Run on 2026-10-14, verified (won_on, date, YES): `schema_trophy_won_on.sql`.** One nullable
`trophies.won_on date`. A dated trophy is placed in match history (Profile
and Your matches), under its year's header, and as a card in the league feed
— read from `trophies`, never written as a post, so removing the trophy
removes the card. Undated honours go under their year (when `season` names
exactly one) and never into the timeline: 31 December would be an invented
date. Rules in `core/trophyTimeline.ts`, tested. On a database without the
column, a trophy given WITH a date fails with a message naming the file.

**Run on 2026-10-21, verified (format, YES, 1 — Zaach's tagged): `schema_trophy_format.sql`.** Nullable
`trophies.format` ('singles' | 'doubles'), and it tags existing trophies whose
competition says "doubles" — that one data change was flagged to Sam. **A
trophy never counts in any rating** (Sam's ruling, same day): the matches that
won it do that when logged, and a bonus would count them twice. The tag only
decides which side shows it — doubles feed, doubles profile history — with
untagged on the singles side as always. On a database without the column the
forms still save; the tag is dropped and retried without (`insertTrophyRow`).

**Run on 2026-10-21, verified (4, 0, true): `schema_security_winter_a.sql`** (branch
`winter-pilot`, but it needs no code and is live). The audit that day, asked
of the live database through `diagnose_security.sql`, found:
- `schema_shared_storage_rls.sql` HAD been run, so other clubs could not touch
  a club's settings — but any member could rewrite the season, and its key
  parser did not know `league:<id>:rankSnapshots`, so **weekly movement had not
  been saving for anyone**. Part A fixes both: members read and write their
  own club's settings and snapshots, owner/organisers only for `groups_`.
- **`join a league as yourself` checked `user_id` but not `role`**, and
  `leagues` is readable by anyone (`using (true)`, anon included) — so any
  account could make itself owner of any club. Closed by Part A; checked the
  same day that every owner/editor row is the club's own creator, so it was
  never used.
- `is_league_staff(uuid)` was added there. It is a policy predicate like
  `is_league_member`: **never revoke it from anon**.
**winter-pilot merged to master 2026-10-21 (976f4eb, fast-forward). Run the same day, verified (0, true, false): `schema_security_winter_b.sql`**
— drops the `using (true)` read on `leagues` in favour of
`find_league_by_code()`. Members still read their own clubs through "read
leagues you belong to". Nothing reads another club's row directly any more.

**Run on 2026-10-21, verified (true, 1, true, true, 2): `schema_seasons.sql`.**
Seasons are rows now (`seasons`, one active per club by unique index,
organisers write), `close_season_if_due()` closes one the day after its last
UK day, competitions carry `season_id`, and fixtures / doubles_fixtures carry
`play_by` and `outcome` (walkover / void). `guard_competition_fixture()` makes
CHANGING those organiser-only and stops a player deleting a competition tie;
drawing a new tie stays open to members. The one data write copied Seacourt's
"Test League" season out of the settings blob (the blob is untouched and is
now only the fallback `useSeasons` reads when the table is missing). A
season's standings "freeze" by rule, not storage: matches dated in it and
logged before `ended_at` (`core/seasonStandings.ts`).

**Run on 2026-10-21, verified (true, true, 2, true, false): `schema_levels_organisers.sql`** (winter-pilot). Live on the real database, so master's app is already bound by it: a player who has a level can no longer change it themselves, even before winter-pilot merges.
A trigger on players lets only owner/organisers change `level` /
`level_history` (or the player's own first pick while they have none);
`set_player_level()` is the organiser door that also reaches signed-up
players; `level_changes` logs every change by trigger; `level_requests` holds
players' asks.

**Fairness check, 2026-10-21 (brief item 3), on Sam's real Seacourt export —
no formula changed.** `scripts/fairness-report.mjs` reruns every rating with
and without one player's matches against the top player. Charlie Henry's 35
matches against Zaach (9-0-26): Official 40.5 with them, 36.5 without; Strength
709 against 684; Elo 80 against 41. So Official and Strength reward playing
the best and Elo punishes it — Elo is the one with the problem, and it is the
§9 level-multiplier asymmetry again. 7 of 115 losses all-time raised the
loser's Official points (largest +3.8, Mike losing to Hugh): the activity term
plus the cheap cost of a loss to a stronger player. A −1000000 in that report
is the no-games sentinel, not a score.

**Run on 2026-10-21, verified (true, true, false): `schema_starting_record_organisers.sql`**
(winter-pilot). Live on the real database, so master's My profile fields are
already refused for players who have a starting record. Sam: the starting rating/record is "the same loophole as levels,
just through a different door". It replaces `guard_player_level()` so
`initial_elo` / `initial_record` follow the level rule exactly (organisers for
anyone; a player's own only while both are empty, i.e. onboarding), and adds
`set_player_start()`.

**Ranking cut-offs, Sam's ruling 2026-10-21.** All-time table: 5
(`PROVISIONAL_GAMES`). Season table and its podium: 3 (`SEASON_RANK_GAMES` in
`core/seasons.ts`). Competition/group tables: none — they rank on points.
New league-format competitions default to play each other twice.

**APPLIED 2026-10-21 (winter-pilot): "a loss can never raise your Official points".** Sam
wants it ("I lost and my points went up" breaks trust, even at 7 in 115). The
cause is the activity term, `gp / (gp + 10)`: a loss to a strong player costs
as little as 0.4 but still adds a game of activity. The proposal is one line —
activity counts wins and draws only, `(w + d) / (w + d + 10)`. On Seacourt's
real export it takes the cases from 7/115 to 0/115 (all time) and 5/59 to
0/59 (2026), keeps Charlie gaining from playing Zaach (+1.9), and lowers
everyone with losses (Adrian 35.2 → 23.3, Charlie 40.5 → 32.2). Order changes
only at the foot of the all-time table. Sam approved it the same day.
`official.test.ts` now pins Seacourt 2026 at Zaach 52.5, Sam 45.1, Charlie
33.6, Adrian 19.6 (was 58.3 / 50.0 / 42.8 / 32.4) and checks that six losses
in a row to the best player never raise you; the real-export report reads
0 of 115 and 0 of 59. Sam's ask for the merge: a feed announcement ("losses
no longer add points") so the overnight drop doesn't read as a bug.

**Data change, run 2026-10-21, verified (0, 0): `delete_test_comp.sql`.** Sam
tested the competition screens inside the real Seacourt club and entered 30
results into a "Test comp". He saw the list first (`diagnose_test_comp.sql`,
every Seacourt match logged that day — all 30 were the test, nothing else)
and approved the delete: those 30 match ids and the competition, whose
fixtures and entries cascaded. **Tests go in the Test club, never Seacourt.**

**Winter Phase 2, on winter-pilot (2026-10-21), Sam's rulings:**
- **"Count this as a league game?"** (built FIRST, Sam: "players will log with
  + out of habit"). Log a result asks when the two still have an open
  competition tie; nothing attaches without a yes. `core/leagueGame.ts`.
- **48 hours to confirm** (`CONFIRM_WINDOW_MS` in `core/matchStatus.ts`), was 24.
- **A dispute never deletes.** Status `disputed`: counts for nothing, waits in
  Run your club → Disputed results for an organiser to keep or remove. "Cancel"
  on your OWN unconfirmed result still deletes — it was only your claim.
  Removing a result reopens the competition tie it settled.
- **Short / unfinished match**: status `short`. Feed and head-to-head show it,
  labelled; `countsAsPlayed` is false, so no rating, table or competition. The
  global SQL counts only `confirmed`, so it needed no SQL. Neither new status
  needed a migration — `matches.status` has no check constraint.
- **Feed headlines**: 75% of games "dominates", 90% "demolishes", six games
  minimum (`core/domination.ts`); "First meeting" per pair (`feedContext.ts`).
- **Head-to-head counted every row between two players**, bookings and
  disputes included. Now `countsAsPlayed` like everything else. Found in passing.
- **Booked matches last 1 hour by default** (was 2), with 1 / 1½ / 2 hours at
  booking. **Needs `schema_fixture_duration.sql`** for a non-default length to
  save; the default writes nothing new, so bookings work either way.
- **Merged to master 2026-10-22**, with two more of Sam's rulings: match history
  shows a word (`gradeAgainstHistory`) instead of the per-match Elo change —
  the Elo number swung −0.9 to −17 for the same loss because of the level-gap
  scaling (option D, fixing Elo, is deferred until Sam sees numbers); and a
  score that disagrees with the winner is refused (`scoreProblem` in
  `core/sets.ts`). Sam is fixing Charlie Henry's level history (stops at
  2026-09) and the two bad scores (14 Sep 6-6, 20 Mar Will v George) by hand.
- **Emails built 2026-10-22 (winter-pilot)**: southwood.app VERIFIED in Resend
  (Ireland; 4 DNS records in Porkbun, wildcard parking CNAME deleted);
  `RESEND_API_KEY` (Production only) and `SUPABASE_SERVICE_ROLE_KEY` set in
  Vercel. `app/api/notify` sends "challenged" (new fixture with a time) and
  "booked" (time set) to the OTHER side, checking the caller's token and that
  they are in the fixture or staff. `app/api/cron/reminders` (vercel.json, daily
  08:00 UTC) sends result reminders and 7/2-day deadline warnings
  (`core/emailSchedule.ts`, tested). `email_log` makes every email once-only;
  `profiles.email_opt_out` is the My profile switch. **`schema_email.sql`
  run 2026-10-22, verified (email_opt_out, YES, true).** Singles fixtures only; doubles fixtures send nothing yet. Optional
  `CRON_SECRET` env var locks the daily job to Vercel.
- Emails (item 6): Sam bought **southwood.app** (Porkbun, 2026-10-21) for sending through Resend. The API key and the Supabase service-role key belong in Vercel's environment variables, set by Sam — never in the repo or the chat.

**brief-2 (2026-10-22), item 1 settled without SQL.** Sam had logged three
test wins for Charlie Henry over himself in Seacourt (pending, so counting).
He cancelled them himself from the feed — a reporter cancelling their own
pending result deleted cleanly — and confirmed they're gone. NB pending
results do NOT expire: they auto-confirm after 48h (CONFIRM_WINDOW_MS) unless
disputed or cancelled. Measured on them before they went: each was worth
about +1.6 to Charlie and −0.9 to Sam on Official; Sam stayed #2, Charlie #3.
**brief-2 merged to master 2026-10-22** (rollback: branch
`rollback/pre-brief2-2026-10-22`): per-match Official points in match history
with a Why? (`core/officialTimeline.ts`, tested), and the score/winner check
on edits as well as logging. Sam, same day: "the bad scores don't matter" —
`fix_bad_scores.sql` / `diagnose_bad_scores.sql` were dropped in the merge;
the two rows (xefu1o73 "6-6", me3n6foy) stay as they are, and since ratings
no longer read scores they affect only predictions, which ignore a score
that contradicts its result. The Test-club demo season SQL is there if
wanted; Sam has not run it.

**`ratings/glicko`, merged to master 2026-10-22 (rollback: branch `rollback/pre-glicko-2026-10-22`).** Sam's two
rulings after the four-system comparison on the real export (every system
predicted 68-71% of 115 decided matches — noise; level alone 78%, but the
histories were written with hindsight):
- **Glicko-2 is a table mode beside Official** (`core/glicko.ts`, tested
  against Glickman's worked example). Levels are the start only: 1500 is
  Intermediate/Low, 50 per step, ± 200 with a level at your first match and
  350 without. Every match is its own update and the ± grows weekly while you
  don't play — that is the recency. Over ± 110 the row says "provisional"
  (first in the stat line, which truncates) and the number goes quiet. It
  does NOT replace the 5/3-match cut-off (and the ± line is 130 since the
  one-table change, below). A provisional first place never
  gets the Leader card (Sam's ruling): it stays an ordinary row, and the
  card does not pass to whoever is next.
- **Ratings read win/draw/loss only; the score feeds predictions.** Elo,
  Official's strength graph, Strength and the Global table no longer blend
  `MARGIN_WEIGHT`; `predictionResult()` in `core/predict.ts` is the only
  reader (head-to-head and form inside `predictProb`, so Compare, the
  favourite and the venue prediction follow). A missing, unreadable or
  contradicting score (`scoreProblem`) counts as no score. This supersedes
  §3's "Margin counts" for ratings. official.test 2026 pins moved
  52.5/45.1/33.6/19.6 → 53.0/45.8/34.3/20.0, same order.
- **Sam's flag for later:** five rankings (Official, Elo, Strength, Glicko,
  Global) is too many for a club. After watching Glicko for a few weeks,
  pick ONE headline ranking and tuck the rest away. Not before.

**`table/glicko-only`, merged to master 2026-10-22 (rollback: branch
`rollback/pre-one-table-2026-10-22`).** Sam's ruling: the Table is ONE
ranking, Glicko. No Ranked-by or year chips (This season / All time stays;
Official, Elo and Strength are still computed for predictions, recap and
the Global table). Placed players first; provisional ones (± over
`GLICKO_PROVISIONAL_RD`, **raised 110 → 130**: 3 placed on Seacourt's real
results at 110, 7 of 9 at 130) under a heading with a dash for a place;
everyone short of 5 / 3 matches in one tappable line. **Home's card and
"your place in other clubs" use the same rating** through
`glickoStandings()` in `core/glicko.ts` (the Table's default view: this
season while one runs, active players, same ± line and tiebreak), captioned
"rating · this season / all time". Weekly movement arrows are off on both:
the snapshots still record Official places. `officialRanks` and `movement`
in RallyApp are now read by nothing on screen.

**First-time tour, merged 2026-10-22 (rollback: branch
`rollback/pre-tour-2026-10-22`).** `home/FirstTour.tsx`, five steps, one per
bottom-bar tab, each switching to its screen. Once per person (`tour.v1` in
user_storage, failed read = seen), so every existing member sees it once on
their next visit; Help → "Take the tour" any time. What's new bumped to
RELEASE `2026-10-22` (tour, one table, points per match, emails) and the
September entries cut.

**Run on 2026-10-22, verified (YES, 3): `schema_friendly_fixtures.sql`.**
`fixtures.league_id` is nullable, and read / insert / update each carry a
league-less branch for the two players in the fixture (insert only for one
of them). So "Book a match" inside Friendlies works at the database. No data
touched; club fixtures behave exactly as before.

**Data change, run 2026-10-22, verified (0, 122): `delete_test_season.sql`.**
Sam's ruling: Seacourt's "Test League" season was only a tester nobody in the
club knew about, so it was deleted rather than ended (ending posts winners
to the feed). Only the season row; all 122 matches untouched. Seacourt has
no season until Sam starts James's real winter one from Run your club →
Season, so its Table opens on All time meanwhile. Charlie Henry's level
history now runs to "Oct 2026–now" (Sam did it in the app).

**The singles ladder, merged to master 2026-10-22 (rollback: branch `rollback/pre-ladder-2026-10-22`).** Sam: Seacourt's
real ladder is a wooden board mixing singles and doubles, so doubles players
sit high and Zaach is below people who never play him at singles. This is
singles only. `core/ladder.ts` (tested): challenge up to `LADDER_REACH` (3)
places above, a win takes the defender's place and shifts those between down
one, one open challenge per player, `LADDER_DAYS` (14) to play, newcomers at
the bottom. Stored as a singles competition with format `ladder` — entries'
seeds are the starting order, each challenge is a competition fixture with
the CHALLENGER as p1 — and the order is replayed from decided challenges,
never stored. `Ladder.tsx` is a card on the Fixtures tab; organisers start it
(active players in Glicko order), add/remove anyone and settle an unplayed
challenge (walkover / call off), or delete the ladder to start it again; the
starting order puts settled ratings before provisional ones (Lloyd, one match,
topped the first try). **`schema_ladder.sql` run 2026-10-22,
verified (YES, 2)**: the format check names 'ladder', and two policies let a
player add or remove their OWN entry on a ladder.

**Divisions on the Table tab, merged to master 2026-10-22 (rollback: branch
`rollback/pre-divisions-2026-10-22`).** Sam wants box-league-style divisions
"like football". A division is just a League competition; the Table tab's
switch is Standings | Divisions | Compare, Divisions listing every running
league table (`competitions/Divisions.tsx`, sharing the exported
`LeagueTable` with the competition screen) ordered by the number in the
name, each labelled Top / Middle / Bottom tier by position (`tierLabel`).
Organisers always see the tab, with "Create a division" / "+ Add a
division", which open the competition form preset as "New division ·
Division N" (league only) and return to the tab after. Promotion and
relegation between seasons is still by hand — a proper box league (app
proposes next season's boxes) is the follow-up Sam wants to dissect.
Also from that day: Fixtures' search box shows from six fixtures up and
lost its inner border; the competition form no longer reopens on every
visit to Fixtures (module-level handled create signal).

**Season awards and promotion/relegation, merged to master 2026-10-22
(rollback: branch `rollback/pre-awards-2026-10-22`).** Sam: "the app proposes next season's divisions, the
coach confirms" and "a trophy on their profile and a post in the feed, no
admin".
- `core/promotion.ts` (tested): top N up / bottom N down (default 2, never
  more than half a division), by-hand moves. `PlanNextSeason.tsx` on the
  Divisions tab ("Plan next season", organisers): creates the new divisions
  (same names, legs, points) in a DIFFERENT running season, draws them with
  that season's deadlines, and marks the old ones finished. Singles ties are
  saved in ONE saveData — a save per division would diff against a stale
  league and undo the one before.
- **The season podium is Glicko now** (`seasonPodium`), established players
  only, judged as at the season's last match so post-season quiet cannot
  inflate the ±. First place is "Player of the Season" in the season-end
  post. Caveat measured in the test: an unbeaten run against much weaker
  players keeps a wide ± (Glicko learns little from expected wins), so a
  runaway leader can be provisional; real Seacourt leaders sit at ± 87-95.
- `core/seasonHonours.ts` (tested): Player of the Season and each league
  competition's winner, per ENDED season, DERIVED, never stored — shown first
  in the profile's trophy list (not removable). No permission problem at the
  moment a member's app closes the season, and corrected results correct
  them.

**Division settings, merged to master 2026-10-22 (rollback: branch
`rollback/pre-divmanage-2026-10-22`).** Each division card has Settings for
organisers: add a player late (0 points, ties drawn against everyone due by
the season's end), take one out (unplayed ties go, results come off), fill
from results already played (`core/backfill.ts`, tested: earliest counting
match in the season window per open tie, round by round, never one match
twice), delete. Singles only for add/remove/fill. Tapping a row in any
league table opens that entry's results with the points each earned (same
confirmed-only filter as `leagueTable`, so it sums to Pts), what is left
and "Open profile". Only Division 1 carries a tier chip ("Top tier") —
Sam: bottom tier wasn't needed. The season prediction runs on Glicko, and
Last 5 on the profile is W/D/L letters with the opponent's name.

**Profile places are Glicko (merged 2026-10-22).** The record card's club
place and "one place behind X" come from the same all-time
`glickoStandings` as the Table / Home / other clubs; the Elo and Record
rows are gone, a Rating row (± shown) replaced them.

**Motion and labels (merged 2026-10-22, Sam: "smooth like Apple", "nothing
in a code-looking font").** `ui/Motion.tsx` in the root layout: press
feedback on anything tappable (buttons, links, any pointer-cursor element),
a rise-and-fade on every position: fixed element as it mounts (sheets,
full-screen views, the toast — via MutationObserver, animating `translate`
so an element's own transform survives), and `useScreenIn` on RallyApp's
content for tab changes and Back, header excluded. Off under
prefers-reduced-motion. **No small label is spaced capitals any more** —
sentence case, no tracking, two points up. Only display headings (TABLE,
PROFILE, the wordmark) and the join-code box keep capitals; don't bring
uppercase labels back.

**Run on 2026-10-23, verified (2): `schema_division_dates.sql`**; merged to
master the same day. Nullable `doubles_competitions.starts_on / ends_on`;
null = the season's dates (`divisionDates` in `core/backfill.ts`). Saving a
division's dates in Settings reopens ties settled by matches now outside
them (`tiesOutsideWindow`, tested; walkovers/voids stay), refills from
inside, and moves unplayed play-by to the new end, in one save.

**Merged 2026-10-23:** an organiser can edit/delete a match from match detail
when NEITHER player has an account (Sam: "only if they're shell players").
And Fill's "already used" is per division: a match may settle one tie in
each division both players are in (Division Everyone runs alongside the
others), and a match that settled a plain booked fixture still counts.

**Also merged 2026-10-23 (Sam: "fix stuff while we have time"):** "Count
this as a league game?" offers "Yes, count it in all N" when the pair has
open ties in several divisions (`saveLogged` takes tie ids); division row
results carry the match date (`CompetitionResult.date`) and list newest
first; the empty trophies card no longer repeats its heading.

**Rallio answers, merged to master 2026-10-23, no SQL:**
- **Club night mixer** — doubles Fixtures → Club night mixer.
  `core/doubles/mixer.ts` (tested): sit-outs shared first, then no repeat
  partners, then no repeat opponents, then balanced pairs on doubles rating;
  seeded, so the night survives a reload (kept in localStorage
  `rally.mixer.<league>`). "Log" opens DoublesEntry with `preset` seats; a
  mixer game is an ordinary doubles result.
- **Clubhouse TV** — Profile menu. `board/ClubBoard.tsx`: table (all-time
  glickoStandings), latest singles + doubles, booked fixtures, clock, QR to
  the invite link (`qrcode-generator`, the only new dependency). Re-reads the
  club every minute via `boardRefresh`, Wake Lock, read-only.
- **Message to arrange it** on a fixture you're in, when the opponent has an
  account (FixturesPanel `onMessage`).
Still not built: Open games (needs a table) and tournaments with handicaps.

**Merged 2026-10-24:** "Who wins each division" at the foot of the Divisions
tab — `core/divisionOdds.ts` (tested) plays each division's open matches out
4,000 times on rating expectation (Glicko singles, averaged doubles rating
for pairs) from today's points; ties at the top shared. Since the same day the ± counts
(Glickman's g, `rd` option): Connor Truman, a few matches old, read 88% before.
The card has a Copy button (plain text for the club chat).
**The real cause, found after:** Connor had never played, so he had no Glicko
entry and the odds fell back to 1500 — above everyone in Division 2. A
player with no games now starts from `glickoSeed()` (core/glicko.ts:
`levelNow`, 1500 ± 50/step, ± 200; no level → 1500 ± 350). The mixer row shows
on Fixtures in both modes (switches to doubles); Clubhouse TV is
organisers-only.

**Southwood is the default theme again, cream, brass and ink (merged
2026-10-24, Sam's mockups).** `DEFAULT_THEME = "rally"`, the column default
is 'rally' (run, verified), and `data_theme_back_to_southwood.sql` moves
everyone on London back (Sam runs it after the merge). Ink #2A2118 is for
text and icons only, never a filled block. Brass #B8955A only on the icon,
the ONE hero card per screen (`sw-hero`: Home ranking card, Profile career
record), win dots, progress bars and the + button, never text. Secondary
buttons are an ink outline; the selected segment is a white pill. Pattern:
a variable only this theme needs (`--win`, `--loss-fill`, `--seg-on`...) is
`initial` in the shared `:root, [data-theme="rally"]` block (which every
other theme inherits) and real in a rally-only block, so `var(--x, old)`
keeps the other four themes exactly as they were. The fill-to-outline rules
match React's inline `style*=` text and are scoped to `[data-theme="rally"]`.

**Laptop layout, step 1, merged 2026-10-24** (Sam: "a full website version
and app versions"). One app, not a second site: from 1024px the rules at the
foot of globals.css turn BottomNav into a 248px sidebar (mark, Add result,
the four tabs), put RallyApp's content (`.sw-main`) in an 860px column right
of it, and open full-screen views (`.sw-overlay`) beside it. Classes are
`sw-*`; the rules are `!important` because components style inline. Phones
never reach them. Next, per Sam: each screen using the room (Table with
the player alongside, Fixtures side by side).

**Laptop step 2, Home in two columns (2026-10-24).** From 1280px only (below
that the column beside the sidebar is too narrow for two): `sw-home-side`
(greeting, your place, What's new, results to enter, next match) left,
`sw-home-feed` right, and Home alone widens its page to 1180px (`sw-wide`
on `.sw-main`). On a phone both wrappers are plain blocks. Same commit: the
first-time tour on a laptop dims only the page, leaves the sidebar lit and
centres its card with no pointer — step 1 had left it pointing at a bottom
bar that wasn't there.

**Glitch fixes, merged 2026-10-24.** Motion animations use fill-mode
`backwards`, never `both`: a held last frame leaves `translate: 0 0`, which
makes the element the containing block for every position: fixed sheet inside
it (the year picker opened at top −900px). `useSeasons` keys its loaded flag
to the club and never falls back to the settings-blob season before the table
answers (Seacourt's blob still holds the deleted Test League — Home flashed
"2nd" before "4th"). Profiles open in place through `lib/openProfile.ts`;
somebody outside the club gets PublicProfile over the app. Never send the app
to `/?profile=` or `/players/` with window.location from inside RallyApp.

**One top row on every tab (2026-10-24, Sam: "everything moves when
selecting the tabs").** RallyApp's `topRow` — mark + club pill left; search,
messages, bell, menu right — is the first thing on Home, Table, Add result,
Fixtures and Profile, always inside a `<header>` so the screen-change fade
leaves it still (Home's is rendered outside Home; HomeHeader takes `topRow`
and omits its own row). Only the title under it changes. The menu is on
every tab now; the theme picker lives in the menu.

**Coach clean-up, merged to master 2026-10-24 (rollback: branch `rollback/pre-coach-cleanup-2026-10-24`).**
Sam's 17-point list. **RUN 2026-10-24, all verified:** `schema_moderation.sql`
(2, false, false), `schema_theme_london.sql` (DATA: everyone on 'rally' moved to
'sw19'; 'sw19'::text, 0) and `fix_function_grants.sql` (anon false everywhere
but is_league_member / is_club_admin). His rulings: London for
everyone on the old default; divisions renamed/ended by buttons in division
Settings (Rename / End this division — End voids unplayed ties, keeps the
table); removed members and deleted accounts are hidden (not playing), results
kept; a club creator deleting their account hands the club to another owner,
or is refused with nothing changed (leagues.created_by is ON DELETE CASCADE —
deleting a creator's login would delete the club). `/api/account/delete` needs
`SUPABASE_SERVICE_ROLE_KEY` in the environment it runs in (Production has it).
Deleted players become "Former player" (`isFormerPlayer`, never claimable).
`core/nameFilter.ts` (tested) checks names on sign-up, My profile, add player,
organiser edits — whole words and a few stems. The club sheet (`GroupSheet`)
is now the landing page's cards; "Everyone I've played" left it. The singles
ladder is behind `SHOW_LADDER = false`. `/privacy` page, linked from sign-up
and the menu. Weekly roundup card compacted; lining figures globally
(Cormorant, London's display face, sets old-style ones by default).

**RUN on 2026-10-24, verified (1, integer): `schema_match_delete_shell_and_pending.sql`
and `schema_fixture_duration.sql`.** History of the first, kept: until it
was, deleting a match against a shell opponent, and Dispute/Cancel on a
pending one, are refused. `schema_match_delete_agreement.sql` widened DELETE
for participants but both of its branches require `delete_requested_by` to be
set, and those two paths correctly never set it — there is nobody to agree
with when the opponent has no account, and a pending result is one person's
claim rather than a shared record. The refusals were silent until
`deleteRow` started checking (see below), which is what turned a returning
match into a visible "that delete was refused".

**A DELETE that RLS refuses is not an error in Postgres.** It matches no rows
and reports success. `deleteRow` in `lib/leagueData.ts` therefore asks for
the deleted rows back and, if none came, looks to see whether the row is
still there; a row that survived is raised as a failure so `saveData`
re-reads and shows what is really stored. Anything writing a delete against
Supabase needs this check or it will lie.

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

- **The four syncs are not atomic, and nothing says so.** `saveData` runs
  `syncPlayers` / `syncMatches` / `syncFixtures` / `syncPosts` in one
  `Promise.all`, and each runs its own writes in another. There is no
  transaction anywhere. Resolving a fixture is an *insert* into matches and
  an *update* to fixtures as independent requests, so a fixture can end up
  marked `done` with a `match_id` pointing at a match that was never
  created. Not hypothetical in shape, though it is not what bit on 2026-09-11
  — that one wrote nothing at all.
- **`assertWritable` throwing takes the whole matches sync with it.** It is a
  plain `throw` inside the loop that builds the write ops, so a match it
  refuses aborts `syncMatches` **before a single row is written**, while the
  other three syncs are already away in their own promises — a save that is
  half applied and reported as one failure.
  (Corrected 2026-09-11: an earlier note here claimed it scanned every match
  in the league and that one bad row would block all writes forever. It does
  not. `toRow` is only called for rows being inserted or changed, so an
  untouched bad row is never validated.)
- ~~A score typed with no winner tapped is lost silently.~~ Fixed
  2026-09-11: the text survives closing and reopening the same row, and is
  cleared when you open a different one so it cannot reappear against the
  wrong opponent.
- ~~`matchToRow` drops `loggedAt`.~~ **Wrong, withdrawn 2026-09-11.** There
  is no `logged_at` column because none is needed: `rowToMatch` derives
  `loggedAt` from `created_at`, which Postgres sets. Setting it locally at
  creation is a harmless nicety the reload replaces.

**A list presented as the contents of a number must contain that number's
contents.** Sam counted 31 wins on his profile where the tile said 28. The
tile was right: every number in the engine drops a match the opponent hasn't
confirmed, and exactly one list — `bouts` in `RecordBody` — had no status
filter, so the history and the tap-through from the Wins tile both showed
three unconfirmed wins as ordinary ones. `BoutRow` marked *edit pending* and
*delete pending* but had nothing for a result nobody had agreed to yet. The
tap-through now shows what the tile counted; the full history still lists
pending matches, marked, because they are real matches and hiding them is a
worse answer than explaining them.

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

- **`$$` in a String.replace REPLACEMENT means one literal `$`.** So any
  script that rewrites SQL through `replace()` silently halves the dollar
  quotes on a function body, turning `as $$` into `as $`. It is invisible
  when reading the diff, and Postgres rejects the whole file. This cost Sam a
  paste on 2026-09-12. **Pass a function as the replacement** —
  `replace(a, () => b)` — which turns off `$`-substitution entirely; `$&` and
  `$1` have the same problem. `npm run check:sql` now catches the result.

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

**The Global table now runs on the network rating.** Sam ran
`schema_global_edges.sql` on 2026-09-04 and confirmed the result: "looks very
good and correct". So `global_edges()` exists, `loadGlobalStandings()` gets
its edges, and `computeRatings()` in `core/rating.ts` produces the order.
**This is the live behaviour — don't describe it as un-run, and don't
rebuild it.** One `drop function public.global_edges();` reverts to the old
maths, and that fallback is already deployed.

`schema_global_standings_perf.sql` is still dead and still un-run. The code
that read it was reverted in 7b1e307. Leave it.

### What the data actually said, 2026-09-04

Sam pasted a live extract (every confirmed match, every player's level and
level history — one `json_build_object` query, in the session log) and
separately wrote down his own top ten for the club. That combination is what
every earlier attempt lacked: real results **and** a target to check against.

Ask for both again before touching any ranking. The extract beats the
head-to-head query below for this, and `backups/` is still stale.

**The level multiplier in `core/elo.ts` is genuinely broken, and not in the
way anyone was looking.** `LV_MIN = 0.05` means a higher-rated player beating
a lower-rated one scores a twentieth of a normal result, while losing to one
runs up to 2.8x. Measured: **30 of 89 decided matches are pinned at 0.05**.
Adrian beat Zaach four times for **+6.1 total** and lost to him six times for
**-100.6**, which is why the best player Sam knows sits last on ELO. Hugh is
3-0-0 including wins over Mike and Sam and has earned 3.2 points, because he
claimed Pro so every win is "expected". **The app punishes rating yourself
honestly.** Fixing the asymmetry is worth doing on its own merits.

But it does **not** fix the order. Measured as total places away from Sam's
own ranking: ELO today 34, floor raised to 0.35 → 34, symmetric multiplier
→ 32. Barely moves, because five of Sam's top eleven have three matches or
fewer and one (Flynn) has none. **That part is missing data, not maths**, and
no formula reaches it. Don't try — a formula that hit Sam's list from this
data would be fitting his opinion, not measuring results.

**The network rating lands it: 10 places out, against 34.** `computeRatings`
run over the real match graph, nothing tuned, every constant exactly as
written, gets Sam's top four *exactly* — Hugh, Mike, Zaach, Adrian — and puts
Zaach above Sam, which was the original complaint. Of 24 head-to-head pairs
with a clear leader it inverts one (Sam beat Adrian once in 2019). Its
remaining disagreements with Sam are Will and Oliver, who have one recorded
match each — the missing-data pile again.

**The complaint that started it all was narrow**: Zaach beat Sam twice and
ranked below him. Three rebuilds were attempted on stale data and none was
needed. The fourth answer wasn't a rebuild at all — it was running the code
that already existed against numbers that were actually true.

**Known and accepted: the top of the table is thinner than it looks.** The
network rating replaces the score outright, so the "under PROVISIONAL_GAMES you are
provisional" pull toward the middle no longer shapes the ordering — the row
still says *Provisional*, but the place number doesn't know. Hugh sits first
on **3 matches**, Mike second on **2**, against Zaach's 44, and neither has
ever played Zaach: their lead is inferred entirely through Sam, who they both
beat. Reversing Mike's single 2019 win over Sam drops him from 9.37 to 6.04
and out of the top four. Sam is happy with the order because he knows
independently that Hugh and Mike are the best two — they have Seacourt
trophies — but **nothing in the data justifies the confidence the layout
implies**.

**Fixed on 2026-09-06, and not by changing the maths.** Provisional players
are taken out of the ranked list entirely and given their own group at the
foot of the screen, with a dash instead of a place and a "3 played" count.
The old screen ranked them 1 and 2 *while labelling them provisional*, and
both of those cannot be true. `computeRatings` still reads every one of their
results — the ordering of everybody else is untouched — but a place number is
a claim about where somebody stands, and `PROVISIONAL_GAMES` is where this
app is willing to make it. **Sam set it to 5 on 2026-09-06**, down from 10:
ten matches left people unplaced for a season in a club where many play a
handful a year, and five still excludes the two- and three-match records the
split was built for. The same constant damps `globalScore`'s `established`
term, which is inert while `global_edges()` exists — split the two if they
ever need different values. Zaach is now first, which is what the data
actually supports.

The threshold is **5 matches** (10 until Sam changed it on 2026-09-06). And
the sort key is the network rating: rows sort on `score`, which
`withNetworkRating` *replaces* with `computeRatings(...) * 100` whenever
`global_edges()` exists. The screen now prints that rating in a labelled
column, because an order nobody can derive from what is on screen reads as
arbitrary — the W–D–L beside it genuinely does not imply it.

---

## 10. The scoreboard design system

Rolled across every screen on 2026-09-06, from a written brief of Sam's —
"Apple Sports", his words. Before it, each screen had its own idea of a card
and its own greys. **Do not restyle a screen away from this**, and don't
introduce a colour that isn't a token.

The shape of it: a dark green page, cards a step lighter, numbers large and
quiet-coloured, words small. Emphasis is **size and colour, never weight** —
nothing above 500, where the old screens ran at 700 and 800.

**Sam, 2026-10-24: the thin weights read "like Word or a spreadsheet or
code" — he wants it bolder.** The landing page and club sheet now run 700
for headings and the greeting, 600 for names and buttons, 500 for small
text. He said the rest of the app is next; this rule is being superseded
screen by screen, so follow his newer ask over the line above. A number is the
loudest thing on any card and the label under it is the smallest.

### The tokens

All in `lib/theme.ts`, all prefixed `FEED_` for the feed they were designed
for and then used everywhere. **They are aliases, not new colours**:
`FEED_PAGE = COURT`, `FEED_CARD = PANEL`, `FEED_RAISED = PANEL2`,
`FEED_LIME = BALL`, `FEED_TEXT_HI = CHALK`. That was deliberate — a second
palette holding its own copies of the brand hexes is two palettes that will
drift. Only the tokens with no brand equivalent hold their own value: the
text tiers, the outcome colours, and the two inks.

- `FEED_TEXT_MID` / `FEED_TEXT_LOW` are the quiet tiers, at **4.98:1 and
  4.55:1 on the card colour** — measured, not judged. Both were originally
  darker and both failed AA for small text. `FEED_TEXT_DIM` is below AA on
  purpose and is only for text that is decoration.
- `FEED_LIME_INK` (#102921) is what you put **on** lime. Not `COURT`, which
  is a page colour that happens to be close; when the page colour is tuned
  the ink shouldn't move with it.
- `FEED_WIN` / `FEED_DRAW` / `FEED_LOSS` colour a scoreline; `DOT_WIN` /
  `DOT_DRAW` / `DOT_LOSS` colour a form dot. They are near-identical and
  separate anyway, because a dot is 6px and a scoreline is 28px and they will
  eventually need different contrast.
- `FEED_HAIRLINE = FEED_RAISED`, because `LINE` on a card is 1.14:1 —
  invisible. A divider you can't see is worse than none, since the space it
  takes still reads as a gap.
- `tabular` is `fontVariantNumeric: "tabular-nums"`, and every number in the
  app takes it. `tight()` applies negative tracking above 18px only — the
  large-type correction, which small text doesn't want.

### The primitives

`components/ui/Surfaces.tsx`. Five things, and they exist because the same
five were being rewritten inline on every screen:

`SurfaceCard`, `SurfaceTile`, `StatNumeral` (tones hi/mid/lime/ink),
`MovementIndicator` (`tone: "onAccent"` for a lime background — an arrow in
lime on lime is invisible) and `FormDots` (`tone: "ink"` likewise, and it was
added *after* the leader card printed five black dots on lime). Plus
`PlayerIdentity`, which is avatar-plus-name and knows the full-name rule.

**Names are `fullNameOf()`.** Never `player.nick` — the nick field is a joke
field, and a session that reached for it produced "The Destroyer beat
Iceman" and printed a second man's name on Charlie Henry's row.

### The screens

Feed, Home, Table, Profile, Match detail, Fixtures, Add result, Compare,
Messages. The scoreline card (`games/MatchCard.tsx`) is one component used
in the feed *and* at the top of match detail — the same result should not be
two designs.

Navigation is **Home | Table | (+) | Fixtures | Profile** since `306dff8`,
which is its own commit precisely so it can be reverted alone. Home is a
dashboard: standing, pending confirmations, tiles. The Table is the ranked
list and nothing else.

**MEASURED 2026-09-20, and it corrects almost everything this file says about
missing levels.** Sam ran the level-state query. Seacourt is largely repaired:

| | |
|---|---|
| Players with a timeline | **21 of 26** |
| Whose timeline covers **every** confirmed match they have played | **21 of 21** |
| Players with matches and no timeline | **5**, holding 12 matches between them |

Sam, Charlie Henry and Zaach each have full coverage — 45, 51 and 46 matches,
all graded. **Their results are not affected by missing levels in any way.**
The long-standing "fourteen of twenty-one have no history" line was measured on
the August snapshot before any repair work and is no longer true; treat every
claim in this file about levels being absent as dated unless it cites this
table.

What is still missing, and it is a short list: **George Henry (6 matches),
Jamie Chevalier-Watts (3), Ivan Snell, Joe Dodgson and Phil HS (1 each)**, plus
Abbie with none. George is the one worth doing — six matches graded flat is
more than the rest put together.

And **Jamie is the answer to the question that opened the day**: Sam beating
him scored 12 because Jamie has zero timeline entries against three confirmed
matches, so `levelAt()` returns null, the level multiplier drops out, and the
win counts at face value. Diagnosed from the code before this data existed and
confirmed by it.

One thing the table shows that nothing else would: **`timeline_from` is the
real coverage test, not the entry count.** Zaach has six entries starting
2025-01 and all 46 of his matches fall inside that window; somebody with the
same six entries starting 2025 but a career from 2017 would look equally
"filled in" and grade flat for eight years. Ask for coverage, never for
presence.

**The league table has a Strength mode since 2026-09-20, and it is the network
rating.** Sam: "I want it to look at opponents — if Sam played Charlie's
opponents and Charlie played Sam's." Every other mode on that screen answers
with a summary statistic and a summary cannot hold a chain, which is the whole
argument in `core/rating.ts`. So the mode hands `computeRatings` one league's
matches instead of every league's. Nothing is tuned and no constant differs
from the Global table's; margin is blended in the same way.

On Seacourt 2026 it says what Sam already believed: Sam 7.94, Charlie 7.90,
**0.04 apart on a scale where a whole category is 3** — against 51.9 and 29.1
on Official. It also puts Adrian second on 9.37, which is where Sam has always
said he belongs and where no summary metric has ever put him.

**Values are x100, and that is load-bearing rather than cosmetic.**
`StandingsList` ranks on `Math.round(p.rating)` on purpose — two players
printing the same number should be treated as level and separated by
head-to-head rather than by a difference nobody can see. But
`computeRatings` works on a 0-12 scale, so at raw size most of the club
rounded into the same two or three integers, every one of those groups was
then ordered by head-to-head, and `ratingColumn` revealed a decimal that
contradicted it: **6.6 printed directly above 6.8**, which is worse than the
identical-numbers problem rankDisplay was written to solve. Scaled up,
rounding discriminates again and the ties are real ties. Seen on screen, both
before and after.

**Any future mode on a tight scale hits this.** The rule is that the number
the table prints has to have enough resolution for `Math.round` to mean
something, because that rounding is what the ranking uses.

**REBUILT 2026-09-27: Official judges every result by the opponent's proven
strength.** Sam's ruling, after seeing three versions on Seacourt 2026's real
matches with levels at the date. Supersedes everything below about the five
best wins, win rate squared and `LOSS_GAP_FORGIVE` — those constants are gone.
An opponent's strength is the Strength table's network rating blended with
their level at the time, the level counting as `OFFICIAL_LEVEL_TRUST` (6)
matches of evidence; a win earns q = strength / club average, a loss costs
clamp(2 − q, 0.4, 1.6), and points = (earned + 1) / (earned + cost + 2) ×
games/(games+10) × 100. The +1/+2 is load-bearing: without it an unbeaten
record scores 100% whoever it beat. `official.test.ts` pins Seacourt 2026 at
Zaach 58.3, Sam 50.0, Charlie 42.8, Adrian 32.4 (was 85.4 / 55.4 / 39.8 /
20.5); nobody changed place, Sam/Charlie went from 1.39× to 1.17×, and
Charlie's thirteen matches against Zaach now add to his score. By design,
beating the best and losing to the worst scores the same as the reverse —
the same performance, as in a chess performance rating.

The history below is kept because it is how this was arrived at.

**APPLIED 2026-09-20: Official weighs a loss by the gap.** Sam ruled after
seeing the numbers. `LOSS_GAP_FORGIVE` 0.10 with symmetric clamps 0.40/1.60,
in `core/constants.ts` next to `LV_FACTOR` and `MARGIN_WEIGHT`. One category
above you costs 0.7 of a loss, one below costs 1.3, and the clamp bites at two
whole categories. **Only the denominator of the win rate changes** — wins,
draws, the five-best-wins quality term and activity are all untouched.

Measured on Seacourt 2026 before applying:

| player | W-D-L | before | after | change |
|---|---|---|---|---|
| Zaach | 18-0-7 | 86.7 | 85.4 | -1.3 |
| Sam | 14-3-6 | 49.9 | 51.2 | +1.2 |
| **Charlie** | 11-3-15 | **29.1** | **40.4** | **+11.3** |
| Adrian | 4-0-5 | 20.8 | 20.1 | -0.7 |

**Nobody changes position.** Sam/Charlie goes from 1.72x to 1.26x, which is
what Sam meant by "three times higher doesn't make sense". Zaach and Adrian
drift down slightly and that is the same rule running the other way: their
losses were to players rated below them at the time, and those now cost more
than one loss.

**The clamps are symmetric about 1 and that took a test to get right.** They
were 0.45/1.45 first, which forgives 0.50 at a gap of five and punishes only
0.45 — the same gap meaning different things by direction, which is exactly
the shape §9 calls genuinely broken in `elo.ts` (LV_MIN 0.05 against LV_MAX
4.0). The symmetry check in `official.test.ts` caught it before it shipped.

`overallScore` was deleted in the same commit: exported, called by nothing,
and the last thing importing `@/lib/format` into this file — which is what
let `official.ts` join the test build at all.

**COMPUTED FROM THE REAL 2026 MATCHES, 2026-09-20.** Sam pasted every
confirmed match of the year with both players' levels as at the date. Running
computeOfficial over them:

| player | W-D-L | win % | qual/win | points |
|---|---|---|---|---|
| Zaach Rodriguez | 18-0-7 | 72% | 2.45 | **86.7** |
| Samuel Henry | 14-3-6 | 67% | 1.71 | **51.9** |
| Charlie Henry | 11-3-15 | 43% | 2.06 | **29.1** |
| Adrian Bowels | 4-0-5 | 44% | 2.13 | 20.8 |

**The quality term is working.** Charlie's average best win is 2.06 against
Sam's 1.71 — the app correctly knows he played the harder people. It is the
win rate that separates them, 43% against 67%, and squaring it turns a 1.55x
gap into 2.4x.

**And the cost of playing the best player is now a measured number.** Charlie
played Zaach 13 times and went 3-10:

| | W-D-L | win % | qual/win | points |
|---|---|---|---|---|
| as it happened | 11-3-15 | 43% | 2.06 | 29.1 |
| had he never played Zaach | 8-3-5 | 59% | 1.90 | **39.9** |

**Avoiding the club's best player would have been worth +10.7 points** — and
that is with his three wins over Zaach included in the quality term. Sam played
Zaach twice and lost both; Charlie is one of only two people to beat him all
year. Unsquaring the win rate closes the Sam/Charlie gap from 1.78x to 1.17x
(78.6 against 66.9).

So the earlier hypothetical was the right shape and the wrong cause: it is not
that quality is inert, it is that **wrReg² outweighs everything quality can
say**. Sam has not ruled on it. Three candidate fixes, none applied: drop the
square, uncap the five best wins, or weigh a loss by the gap the way
`globalScore` has since 2026-09-05 — the league table counts a loss to Zaach
exactly as a loss to a beginner, and the global one stopped doing that a
fortnight ago.

**Official points can punish playing the best player — but NOT for Sam and
Charlie, whose levels are recorded.** Sam, 2026-09-20: he and Charlie are 5-4
head to head this year and would each beat the other's opponents, yet Sam has
roughly double the points. He was right that something was wrong. The first
explanation offered here was that the quality term was inert for want of
levels; the data above says it is fully live for both of them, so that was
wrong and the gap is still unexplained. The arithmetic below stands as a
property of the formula — it is simply not what is happening to these two.

`computeOfficial` is `qualPerWin x wrReg² x activity x 100`. Opponent quality
is `1 + levelVal/6.2`, and `levelAt()` returns null for everyone in Seacourt,
so **q is 1 for every win in the league** — beating Zaach scores exactly what
beating a beginner scores. With quality flat, the only live term is a win rate
that is then **squared**, so anyone taking on the strongest players just looks
like somebody losing more.

Measured, same player, same 10-4 against the mid-table, the only difference
being whether he also splits ten matches with the No.1:

| | no levels recorded | levels recorded |
|---|---|---|
| never plays the No.1 | **27.6** | 54.3 |
| plus 5-5 vs the No.1 | **26.7** | **78.5** |

So today the app pays you to duck him, by about a point. With levels recorded
the same ten matches are worth +24 instead of -1. The quality term does
everything it was designed to do the moment it has anything to read.

This is the same missing data as §11's "almost nothing grades yet" and the 12
points for beating Jamie, arriving at the Official table instead of at ELO.
**The fix is the level histories, not the formula** — and note it needs
histories rather than the dropdown, because `computeOfficial` asks
`levelAt(opponent, matchDate)`. That is what the repair screen collects and
what `set_player_level_estimate` now lets an admin fill in for somebody else.

Structural wrinkles that remain even with levels on, unruled: quality is capped
at your **five best wins**, so a sixth win over the No.1 adds nothing while its
matching loss still counts; and every loss weighs the same whoever it is
against, where `globalScore` learned on 2026-09-05 to weigh a bad loss by the
gap. Do not change either without numbers and a ruling.

The Table's rating bars are scaled **from played players only**. Everyone's
bar was full width because `computeOfficial` returns −1,000,000 for a player
with no games and that sentinel was the scale's minimum. Ten players sit on
exactly 0 Official points, which is a real gap in the formula — it has no
signal below one win — and **Sam has not ruled on the fix**. His two ideas
were partial credit for draws, or a floor by games played. Either changes
live ratings, so §4's rule applies: numbers first.

The Profile is `ProfileView` (filter and expand state) over
`ProfileContainer` (all counting, one place). Lists that back a number must
count what the number counted — see §7.

---

## 11. Your matches

Profile → the playing-style card's Details link (Quality) or the match
history's "All 44" (History). One route, two modes, one computation:
`buildMatchQuality` runs once above the segmented control.

**The denominator is graded matches, and the sentence says so.** "57% of your
graded matches — 8 of 14." Sam ruled on this. A percentage that counts
ungraded matches as "not at or above" understates everybody, and it climbs as
level histories are filled in, which reads as somebody's schedule changing
when only the record-keeping did. The ungraded count sits beside it, and the
banner at the foot of History links to the level-history repair screen.

**There was never a 52%.** Sam asked why the app said 52% where he counted
41%; the answer is that no such card existed — `playingStyle` was a declared
prop on `ProfileView` that `ProfileContainer` had never supplied, so it had
never rendered. The only at-or-above computation in the codebase was
`global_standings()` in SQL, on **current** levels. Measured three ways on
the August snapshot, category and sub-level comparison give *identical*
answers for Sam, because he sits at the bottom of his category — so
methodology was never the difference. The two figures were the same method
over different match sets.

**The thing to know before touching this screen: almost nothing grades yet.**
On that snapshot, **1 of 57** of Sam's matches could be graded at the date,
because he and Adrian are the only players with a level history and a match
needs both. Quality mode is close to empty until §5's repair screen has been
used. That is not a bug in the screen, it is the reason the two features were
sequenced together.

Known and left as briefed: the loss border on a history row is `FEED_LOSS`
at **1.37:1** on the card — effectively invisible, and the same pairing
`MatchHistoryList` already ships. The theme comment says the quiet loss
colour is deliberate ("a loss is a fact, not an alarm") and Sam specified the
hex again in the brief, so both screens keep it rather than one of them
inventing a different loss colour. Flagged, not changed.
