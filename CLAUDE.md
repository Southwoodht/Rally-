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
| Checks | `npx tsc --noEmit`, `npm run test:core`, `npm run build` |

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

**The repo lives at `C:devally`, and deliberately not in OneDrive.** It
was moved there on 2026-09-10. OneDrive was syncing `node_modules` and
`.next` — `.gitignore` means nothing to it — which made every build slow and
kept a few hundred megabytes of regenerable junk permanently on a nearly full
disk. `.next/cache` alone regrows to ~100MB per build, so **clear `.next`
after a build gate** rather than leaving it sitting there. If a session's
preview server reports `'next' is not recognized`, it is pointed at the old
OneDrive path, which no longer has `node_modules`; reopen on `C:devally`.

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

- **The nudge.** A pending result sits there until the opponent confirms it,
  and there is currently no way to ask them. Designed with Sam and specified
  down to the detail: delivery goes through the existing message system, but
  the **source of truth is a `nudged_at` timestamp on the match**, not the
  message — a message can be deleted, and then the app has forgotten
  something it needs to know. One nudge per pending result per 24h, and the
  limit is **enforced in RLS, not by disabling a button**: a disabled button
  is a suggestion. The button then reads "Nudged 2h ago". One added column.
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

**Waiting to be run: `schema_match_delete_shell_and_pending.sql`.** Until it
is, deleting a match against a shell opponent, and Dispute/Cancel on a
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
- **`assertWritable` scans every match in the league, not just the new one.**
  It is a plain `throw` inside the loop that builds the write ops, so one
  malformed row — no winner, status outside the booking set — aborts
  `syncMatches` **before a single row is written**, while the other three
  syncs are already away in their own promises. Every match write in that
  league would fail from then on, with the error pointing nowhere near the
  cause.
- **A score typed with no winner tapped is lost silently.** The three winner
  buttons on a fixture *are* the submit; closing the row discards what you
  typed and nothing mentions it.
- **`matchToRow` drops `loggedAt`.** Both `LogResult` and `resolveFixture`
  set it on the match object and there is no column for it, so it never
  persists. Harmless today; misleading if anything starts reading it.

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
nothing above 500, where the old screens ran at 700 and 800. A number is the
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
