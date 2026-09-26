# Rally — doubles and pairs competitions

Branch `feature/doubles`, pushed. **Nothing is on `master` and both feature
flags are `false`, so no member of any club can see any of this.**

Rollback point if ever needed: tag `rally-pre-doubles-2026-09-25` is master
exactly as deployed before this work started.

---

## PICK UP HERE

**Updated 26 Sep 2026.** Both migrations are run and verified, and the
booking UI is built (branch `claude/continuation-luuz5s`, commit "The doubles
booking screen"). What is left:

### 1. Merge the booking screen into this branch

### 2. Switch it on for Seacourt and do the live checks

```sql
update public.leagues set doubles_enabled = true where name = 'Seacourt';
```

Run and verified on 2026-09-26: `schema_doubles_fixtures.sql` (1 table, 11
columns, 4 policies, 1 trigger) and the grants file after it (twelve
functions closed to `anon`, `is_league_member` and `is_club_admin` still
open, which is correct).

Already run, on 2026-09-25: `schema_doubles.sql` (verified — 2 flags, 1 table,
18 columns, 4 policies, 1 trigger) and the grants file after it.

The two A-Verify steps I could not do myself are below.

---

## What is built

| piece | where | verified |
|---|---|---|
| Migration | `supabase/schema_doubles.sql` | run, output checked |
| Rating engine | `src/core/doubles/elo.ts` | 34 checks incl. the brief's worked example |
| Partners maths | `src/core/doubles/partners.ts` | 18 checks |
| Data layer | `src/lib/doublesData.ts` | — |
| One-load hook | `src/components/doubles/useDoubles.ts` | — |
| Table | `DoublesStandings.tsx` | on screen, Appendix B |
| Partners card | `PartnersCard.tsx` | on screen, Appendix C |
| Profile | `DoublesProfile.tsx` | on screen, Appendix C |
| Home carousel | `RankCarousel.tsx` + `DoublesRankCard.tsx` | on screen, Appendix A |
| Entry screen | `DoublesEntry.tsx` | on screen, Appendix D, form filled |
| Newsfeed line | `DoublesScoreline.tsx` | on screen, four cases |
| Odds | `predictDoubles` | tested |
| Fixtures table | `schema_doubles_fixtures.sql` | run 2026-09-26, output checked |
| Booking UI | `DoublesFixtures.tsx` | on screen, book / reschedule / result / cancel driven in the dev league |

`npm run check` and `npm run build` are green. `test:core` is 383 checks
across ten files.

---

## The decisions that were mine, not the brief's

Each of these is a place I departed from the brief or filled a gap in it.
They are the ones to overturn if you disagree.

**Ratings are derived, not stored.** Your ruling, and it removed two things
the brief asked for: `doubles_rating_history` and a stored `doubles_elo`
seeded at 1500. Rally stores no rating anywhere — `players` has no Elo, no
W/L, no streak — so a stored copy would be a second philosophy that disagrees
with the replay after any failed write. Derived means "recompute after an
edit" is not a special path, it is the only path, and it cannot drift.

**Provisional players get a dash, not a low place.** On the Table and on the
Home card. Same ruling §9 records for the Global table, for the same reason:
the old Global screen ranked provisional players 1 and 2 *while labelling them
provisional*, and both cannot be true. They keep their rating and record.

**"Best with" needs three matches.** On the Partners card and the Home card.
Below that the Home card says "Most with" instead. Picking a best partner off
one win is what the floor exists to prevent.

**Most played with ≠ Best.** Both are shown on the Partners card, because one
is habit and the other is evidence.

**The winner is never asked for on the entry screen.** It is derived from the
sets, because the database derives it the same way and its trigger refuses a
winner that contradicts the score. A winner button would let somebody enter a
contradiction the server then rejects with a message about a trigger. The
"Won" badge is a readout. This is a real difference from singles, where the
winner *is* the input and the score is optional.

**The doubles profile's last-five bars measure rating, not level.** Singles
uses the opponent's recorded level at the time. A pair has no level, and
averaging two dropdown guesses is arithmetic on a guess — `matchGrade.ts`
makes that exact objection about sub-levels. So the height is the opposing
pair's doubles rating as it stood, and the caption says "opponents' rating"
rather than "level" so the two are not presented as the same quantity.
**This is the one most worth your opinion.**

**Doubles fixtures need their own table.** `fixtures` is `(p1, p2)` and every
reader assumes it, so `p3`/`p4` would be invisible to all of them: a doubles
booking would render as a singles one between the first two players and could
be completed as a singles result. The cost, stated in the file rather than
hidden: "my fixtures" becomes two queries and anything listing upcoming
matches must read both and merge.

**Doubles standings numerals are 19px, not the appendix's 17/18.** See the
contrast finding below.

**The Singles/Doubles switch is not remembered.** Unlike the theme or the
season toggle, it is something you flick between within a visit; persisting it
means opening the Table to doubles because of something you did last week.

---

## A-Verify

### Passed

**Singles unchanged, by construction.** Every new branch is gated on the
league flag, so with it off there is no doubles code on the singles path.
Checked that way round first, in the app: flag off, the Table still shows the
Global link, Standings/Compare, the filter pills and the leader card, and
there is no switch anywhere. Home renders the singles hero with no carousel
wrapper at all — not a one-page carousel, which would still draw the dots and
"Swipe for doubles" on a screen with nowhere to go.

Four files singles shares were touched, all additively: `PlayerPicker` gained
an optional `triggerLabel` (singles does not pass it, and I re-checked Add
result end to end — the sheet opens, picking Charlie Henry fills the field),
`Home` gained an optional `doublesCard`, `History` gained an optional
`doublesMatches`, `leagues.ts` selects two more columns.

**With the flag on**, the switch appears, Doubles swaps the standings list,
and Add result renders the doubles form. The override was removed afterwards.

**Tests.** 383 checks, including the worked example to your stated decimals:
+10.35 each winner, −10.35 each loser, +13.80 when the 1532 player is
provisional with his partner and both opponents unmoved. Plus a draw,
input-order independence, and recompute-after-edit equalling
processed-in-order.

**Contrast, all five themes, measured not eyeballed.** Every text node in every
doubles surface, against the first opaque background above it, at the WCAG
threshold for its own size and weight. 135 nodes × 5 themes.

**One real failure, found and fixed.** On **paris**, the viewer's own row in
the doubles table: the accent place number at 17px and rating at 18px measured
**4.21** against the highlighted background, below the 4.5 floor for small
text. Only that theme, only that row.

Fixed by raising both to **19px at weight 700**, which makes them large text
by the WCAG definition and drops the floor to 3.0. Raising the size rather
than dropping the accent keeps what Appendix B is saying — your row is the
loud one — and applied to every row so the numerals do not change size as you
scroll past your own name. Re-measured: **135/135 pass in all five themes.**

**Grep.** No `rgb()` and no hex in any doubles file. The single hex match is
the word `#16271F` inside a comment explaining the bug below.

**One other bug that only rendering found:** the Home carousel's page dots
were invisible. I had coloured them `--on-hero`, which is correct for ink *on*
the cream card and is *also* the page's own background colour — dark green on
dark green, with the hint text below reading as the only thing there. The
indicator sits below the card, on the page, so it needs page tokens. A token
named for what it sits on stops being right the moment the thing moves off it.

### Not done, and why

**Singles standings export, before and after.** Step 1 of A-Verify asks for
this and I cannot produce it: the repo holds only
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, which RLS treats as a signed-out visitor.
There is no service-role key and no database password, which is the same
reason I cannot run migrations. The construction argument and the flag-off
render above are what I have instead. **If you want the export, it is one
query you run before and after switching the flag on.**

**Three live test doubles matches in a scratch league.** Needs a signed-in
write, so same blocker. This is the one genuinely outstanding verification:
log a win, a loss and one involving a provisional player, then check the
ratings, the table and its provisional split, Partners, the Home card, the
feed and the notifications, edit one match and confirm the recompute. Then
delete the scratch data.

**Screenshots of all four screens in all five themes.** I swept the five
themes on one page holding every doubles surface, and measured rather than
photographed. Two visual captures kept (rally, paris). If you want the full
twenty, say so.

**Part B (pairs competitions) is not started.** The brief gates it behind
A-Verify, and A-Verify is not fully passed until the two live checks above are
done.

---

## Known limitations

- **Compare stays singles-only**, as the brief specifies.
- **No pair head-to-head in the odds.** Rating only, your instruction. Worth
  recording why it is right: singles H2H asks how two players do against each
  other and a club has years of that; doubles H2H asks about a pair against a
  pair, and with four people per match the pairings explode while the matches
  do not. Most pair-versus-pair records would be zero or one game — noise that
  swamps the rating rather than refining it.
- **`doubles_matches.fixture_id` points at the singles `fixtures` table**,
  which is the wrong target for a doubles booking. Left alone rather than
  repointed: it is nullable, nothing writes it, and changing a foreign key is
  not additive. `doubles_fixtures.match_id` is the link doubles uses.
- **Doubles Elo starts at 1500 and singles at 0**, with no level term at all
  in doubles. The two numbers are not comparable and must never share a
  column.
