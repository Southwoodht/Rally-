# RALLY FIX REPORT

---

# RUN 2 — PROFILES FOR EVERYONE (11 Sep 2026)

**The complaint:** a second test account with no league, friended to Samuel
Henry, cannot open his profile, cannot see his photo, cannot challenge him.
Profiles should work like Facebook — any signed-in user finds anyone, opens
their profile, and can message, friend or challenge them. No league needed.

## CHECKLIST

- [ ] **Phase 0 — Diagnose** (read-only)
  - [ ] 0.1 Why can a no-league account not view a profile? RLS, query or UI?
  - [ ] 0.2 Profile photos: where stored, public or private, why initials?
  - [ ] 0.3 What every name and avatar tap does today, surface by surface
  - [ ] 0.4 Do /players/[id], player search or friends already exist?
- [ ] **Phase 1 — Profiles visible to everyone**
  - [ ] Any signed-in user can view any player's profile
  - [ ] Never expose email, phone or account settings
  - [ ] Photos load for every signed-in user; initials only when there is none
- [ ] **Phase 2 — Full profile page**
  - [ ] Route /players/[id], full screen with back chevron
  - [ ] Challenge / Message / Friend action row
  - [ ] Record, form, H2H, recent matches, friends
  - [ ] Official rank only when we share a league
  - [ ] Own profile redirects to the Profile tab
  - [ ] Every name and avatar in the app taps through; old popup removed
- [ ] **Phase 3 — Player search**
  - [ ] Search icon on Home and Table headers
  - [ ] Searches all players, not just my leagues
  - [ ] Friends, then league-mates, then everyone
  - [ ] Recents when empty; "No one called ..." when nothing matches
- [ ] **Phase 4 — Wrap up**
  - [ ] Report complete, SQL listed, tap test done from a no-league account

## FOUND, NOT FIXED

_Anything spotted outside the current phase lands here._

## SQL TO RUN

_Collected as the work lands._

---

# RUN 1 — the 10 Sep brief (historical)

Branch `fix/booking-flow`. Brief saved at `RALLY_FIX_BRIEF.md`.

---

## The one thing to read first

**The brief describes a booking system built on match rows. That system does
not exist yet.** Bookings today are rows in the `fixtures` table, which has
no `status`, no `starts_at` and no `result_submitted_by` — it has `done`,
`winner`, `match_id` and `booked`.

What was built previously was the *rules* layer (`core/booking.ts`, 38 tests)
and the migration that lets a match row hold a booking
(`schema_match_bookings.sql`, which Sam ran). No UI writes one.

So several phases name things that aren't there:

| Brief says | Reality |
|---|---|
| "Add the result" action | No such string. Nearest is `resolveFixture` |
| booking row with `status` | Fixtures have `done: boolean` |
| `result_submitted_by` | Not a column anywhere |
| "need at least two people" | Actual copy is different — see item 9 |
| Book a Match picker with Friends / Search segments | It's a plain `<select>` |
| League invite links | **No invite system exists at all** |

Where a phase's *outcome* can be delivered on the model that exists, it has
been. Where it genuinely can't, it's marked blocked with the reason. Nothing
has been guessed at.

---

## PHASE 0 — DIAGNOSIS

### 1. Does "Add the result" update the booking or insert a new row?

**It inserts.** `resolveFixture` — `src/components/RallyApp.tsx:348`.

```js
const mid = uid();
const match = { id: mid, ...,  status: "confirmed", reportedBy: gdata.me };
saveData({ ...gdata, matches: [...gdata.matches, match],
           fixtures: fixtures.map(f => f.id === fx.id ? { ...f, done: true, matchId: mid, booked: null } : f) });
```

So there are always two rows: the fixture (marked done, pointing at the
match) and the match itself. On the fixtures model that is defensible — the
fixture is the arrangement, the match is the result — but it is not what the
brief describes.

**A real bug found here, unrelated to saving:** `status: "confirmed"` is
hardcoded. It never calls `isClaimed()`. So resolving a fixture against a
claimed opponent **force-confirms a result they never agreed to**, bypassing
the agreement rule that the rest of the app enforces. Fixed in Phase 1.

**Silent failure:** low risk. `saveData` re-reads the league on failure and
shows what actually saved, and `deleteRow` raises when RLS refuses. But
`resolveFixture` itself has no try/catch and no user-facing error, so a
rejected write surfaces as "the screen went back to how it was" rather than
as a message. Addressed in Phase 1.

### 2. Last 10 match rows — **BLOCKED**

A coding session cannot query Supabase (CLAUDE.md §9). I can't retrieve them
and won't guess.

**Run this and paste it and I'll finish the diagnosis:**

```sql
select id, status, winner, score, league_id, date, created_at
from public.matches
order by created_at desc
limit 10;
```

Best theory meanwhile, from the code: the result almost certainly *did* save,
but got **dated to the booking, not to today**. `resolveFixture` takes the
match date from `fx.booked` when there is one. If the fixture was booked for
a future date, the match is filed in the future — so it won't appear in "this
month", and it sorts to a place you wouldn't look. It would look exactly like
"it didn't save".

The query above settles it: if the row is there with a future `date`, that's
the cause.

### 3. What does the Fixtures screen filter on?

**Not statuses — fixtures have none.** `FixturesPanel` splits on the `done`
boolean: `done` renders as a result line, everything else as an open fixture.
Ordering is soonest-booked first, then unbooked, then done.

### 4. Same ratings path? Is a null league excluded?

**Yes, same path.** `resolveFixture` writes an ordinary match row, so
`computeStats` / `computeOfficial` treat it identically to one from Log a
result.

**Null league_id is not reachable from any UI.** `syncMatches(gid, ...)`
stamps the current league on every match, so nothing can currently create a
Friendly. The column now allows null (Sam ran `schema_match_bookings.sql`)
but no code writes one. Friendly handling exists only in `core/booking.ts`
(`resolveLeague`, `countsInLeagueTable`) and is unused.

### 5. Every surface that can set `cancelled`

**None.** Nothing in `src/components` writes `"cancelled"` or `"declined"`.
Those statuses exist only in `core/matchStatus.ts` and `core/booking.ts`.

**Deletes that do exist:** matches can be deleted through the
propose/agree/24h-sweep flow (`disputeMatch`, `agreeDelete`,
`cancelDeleteRequest`). Fixtures can be removed as of today's commit, by
either participant or league staff — that needs
`supabase/schema_fixture_delete_participants.sql`, which is **written and not
run**.

### 6. Next Up card — three separate bugs

`src/components/home/HomeTiles.tsx:41`, fed from `RallyApp.tsx:646`.

- **Name:** `first(id)` — `RallyApp.tsx:610` — returns `p.name` only, so it
  is a **first name**, not the full name.
- **Date:** `when: bookedNext.booked` is rendered raw. It is an ISO string
  since the fixtures work landed (it was a raw epoch number before), and
  either way it is unformatted.
- **Not actually next:** `(fixtures || []).find(...)` takes the first match
  in *array order*, not the soonest booking. The tile can show a fixture
  three weeks out while one tomorrow sits below it.

### 7. League invites — **nothing to fix, nothing exists**

There is no invite system. Joining is by **6-character code** only
(`joinLeague(code)` in `src/lib/leagues.ts`), typed into the Dashboard. No
invite table, no links, no tokens, no expiry.

The one origin-derived URL in the codebase is `Welcome.tsx:61`,
`redirectTo: window.location.origin` for the auth email — that is correct
and not hardcoded to localhost.

### 8. Where signup forces a league

`src/components/dashboard/Dashboard.tsx:41`:

```js
if (mine.length === 1) { setActive(mine[0]); setView("app"); }
else if (mine.length > 1) setView("picker");
else setView("empty");            // <- the gate
```

`view === "empty"` is the create-or-join screen, and there is no path past it.
`RallyApp` is only ever rendered with an `active` league, so **Home,
Table, Fixtures and Profile are all unreachable without one**. That single
`else` is the whole gate; everything downstream simply assumes `group` exists.

### 9. The "two people" message

`src/components/games/LogResult.tsx:82`. Actual copy:

> "Add at least two players in Settings before logging a match."

It is a hard early return — the whole form is replaced by that message.

### 10. Emoji audit — 88 matching lines, ~60 real emoji

Full scan over the real ranges (U+1F000–1FAFF, 2600–27BF, 2B00–2BFF, FE0F,
2190–21FF, 2300–23FF), matched on code points so surrogate pairs are caught.

Real emoji, by file:

| File | Emoji |
|---|---|
| `dashboard/Dashboard.tsx:207,213,218` | 🎾 ➕ 🔑 |
| `games/History.tsx:188,206,227` | 📌 📅 📌 |
| `help/HelpGuide.tsx` ×10 | 🎾 📊 ⚔️ 🎾 👤 🏆 🏛️ 👻 🏛️ 🔒 |
| `layout/NotificationBell.tsx:47,58,64` | 👋 🏆 ❌ 📋 |
| `profile/LegacyProfile.tsx:46,90,102,118` | 🏛️ 🌎 👑 📊 |
| `profile/SeasonSummary.tsx:11`, `TrophyWall.tsx:9` | 🥇 🥈 🥉 |
| `profile/VerifiedTrophies.tsx:97,124` | 🏆 ×2 |
| `table/LegacyTable.tsx:19` | 🏛️ |
| `table/RecapCard.tsx:16-19` | 🏆 🔥 ⚡ 🎯 |
| `lib/theme.ts:10` | `AVATARS` — 16 emoji, the avatar picker |
| `data/seed.ts`, `lib/historyImport.ts` | player avatar emoji (data) |
| **`core/achievements.ts:46-54`** | 🎉 🏅 🎾 🔥 🤝 |
| **`core/notifications.ts:29-71`** | ⏳ ✏️ 🗑️ 📌 🤝 |

**The two in bold are inside `src/core/`, which the brief forbids touching.**
They are data (`icon: "🏆"`), rendered elsewhere. Resolved by mapping icon
keys to SVG **at the render layer**, so core is untouched and the emoji still
never reach the screen. See Phase 8.

Not emoji, deliberately left: `→` (U+2192) in `MatchDetail` and `AuthGate`
prose. It is a typographic arrow that renders as text in the page font on
every platform, which is the opposite of the problem emoji cause.

### 11. Profile popup and reusable search

Opens via `openProfile(playerId)` in `RallyApp`, which sets `profileId` and
renders `ProfileModal` over the current tab. Triggers: table rows, feed
cards, match detail, opponent lists, rivalries, the Quality screen's opponent
rows, and as of today the Messages conversation header.

**There is a reusable picker and it is better than the brief assumes:**
`src/components/ui/PlayerPicker.tsx` already does search across
name + surname + nick, create-a-new-unclaimed-player (`auth_id: null`), and
duplicate detection before creating. Used by `LogResult` and `HeadToHead`.

**The Book a Match picker does not use it** — `FixturesPanel` has a plain
`<select>`. That is the actual gap, not a missing search component.

### 12. Friends — exists, fully

`src/lib/friends.ts`: `listFriends`, `listIncomingRequests`,
`listOutgoingRequests`, `getFriendshipWith`, `sendFriendRequest`,
`acceptFriendRequest`, `removeFriendship`. UI at
`src/components/social/Friends.tsx`. Backed by the `friends` table, keyed on
`auth_id`.

**A claim flow exists:** `src/components/auth/PlayerClaim.tsx` — the "Is this
you?" screen, which lists unclaimed player rows for a new account to claim.
`PlayerPicker` already tells you a created player will need to claim
themselves. So players created in Phase 4 are claimable with no new work.

---

## WHAT EACH PHASE DID

### Phase 1 — results save onto the booking · **done, adapted**

The literal ask ("update the booking row, never create a second") already
describes how the fixtures model works: the fixture is the arrangement, the
match is the result, linked by `match_id`. What was actually broken sat
underneath it.

`resolveFixture` hardcoded `status: "confirmed"` and never asked whether the
opponent had an account. Log a result has always asked. So finishing a
fixture against a real person **force-confirmed a result they had never
seen**, straight past the agreement rule the rest of the app enforces. It now
uses the same test. Where league staff fill in a result for two other people,
either of them having an account is reason enough to wait — stricter than the
participant case on purpose, because neither of them has said a word about it.

`saveData` swallowed its own failure: it flashed and re-read, but returned
nothing, so no caller could tell. It reports now, and the fixture form uses
it — a refused save keeps the row open with your score still in it and says
"Couldn't save. Try again."

**Not done:** `league_id` null (Friendly). No UI can reach it — see Phase 6.

### Phase 2 — nothing lingers · **done**

Resolved fixtures left the list. The progress bar still counts them.
Past-due cards read "Add the result". `cancelled` and `declined` cannot
appear because fixtures have no status column at all.

**Consequence worth stating:** Undo went with the branch that held it. The
real undo for a played match is deleting the match, which goes through the
agreement flow like any other deletion, and an owner can still remove the
fixture from Manage players & league.

### Phase 3 — cancel an upcoming match · **done, one part blocked**

Either participant or league staff can cancel. Secondary pill, confirm sheet,
"Cancel your match with {Full name}?" / "Cancel match" / "Keep it". It records
nothing — no match row is created, so it never reaches a rating or a history.

**Blocked: the opponent is not told.** Notifications are assembled in
`core/notifications.ts` and core is off limits under this brief; and
cancelling deletes the fixture row, so there would be nothing left to notify
from even if it weren't. Doing it properly needs a **soft cancel** (SQL
below) plus the inbox item assembled in `NotificationBell`, which is a
component and so allowed. Those have to land together, and the migration
would break Cancel entirely until run. Deleting works tonight with no SQL, so
that is what shipped.

### Phase 4 — add players while logging · **done**

The two-player block is gone. An empty search now offers
**Add "{typed name}" as a new player**, carrying the typed name into the form
rather than making you type it twice.

Duplicate detection widened, which matters more than it sounds. It was an
exact full-name match, and the duplicate people actually create is "Charlie"
when Charlie Henry already exists — a surname typed once and forgotten walks
straight past an exact check. First name, full name and nickname now all
count, all case-blind, prompting "Did you mean Charlie Henry?".

**It only ever asks.** Nothing merges and nothing is chosen automatically:
this codebase has a name-matching incident in its history, and the rule taken
from it is that a name match may become a suggestion and never a decision.

Book a match uses the same picker as Log a result instead of a bare
`<select>`, so booking is no longer the one place you could not arrange a
match with somebody the league had not met yet.

**Scope note:** the "across leagues I'm in" half is not possible — the picker
is only ever handed one league's players.

### Phase 5 — league invites · **done, differently**

There was no invite system: no table, no tokens, no links. Rather than build
a second system that can disagree with the six-character code that already
works, an invite link **is** that code in a URL — `?join=WDZDTQ` — redeemed
through the same `joinLeague()` the typed form uses. No migration.

The signed-out case is the one that mattered and the one that would have
quietly failed: sign-up involves an email round trip and the query string
does not survive it. The code is stashed on first load and redeemed after
authentication, **before** the league list decides what to show — otherwise
somebody arriving on an invite lands on the create-or-join screen with the
thing they were invited to nowhere in sight.

The code is stripped from the address bar once read, so a reload cannot
re-run a join. A code that does not resolve says your line. URLs are built
from `window.location.origin`, so the deployed origin in production and
localhost only when you genuinely are on localhost.

**Not built:** expiry, single use, knowing who invited whom. Those need a real
invites table. The join code is not a secret — it is read out loud in
clubhouses — so putting it in a link gives away nothing the current flow does
not.

### Phase 6 — no league gate · **partial, and the rest is blocked**

The no-league screen was "No leagues yet" with a tennis ball, a plus and a
key on it. It now reads "You're not in a league yet" on a card, with **Join a
league** as the lime primary and **Create a league** secondary — Join first,
because somebody sent you a code far more often than you set out to run a
club.

**Blocked: landing on Home with no league.** `else setView("empty")` is not a
redirect that can be deleted — it is the only branch that exists, because
Home, Table, Fixtures and Profile all live inside `RallyApp`, which takes
`leagueId` and reads that league's players and matches on mount. Running it
league-less is a boot-path change for every user of the app, not a guard to
remove.

I was not willing to do that blind. **The preview server cannot start in this
session** — it is still pointed at the old OneDrive directory and executes a
stale `package.json` — so I could not look at the result, and the boot path is
the one place where being wrong means nobody can open the app at all.

That also blocks the Friendly case: `league_id` null is allowed by the schema
and handled in `core/booking.ts`, but no UI can reach it while every screen
lives inside a league.

### Phase 7 — dates and Next Up · **done**

`formatMatchDateTime` lives in `lib/format` and every screen showing a
booking uses it: "Sat 12 Sep 2026 · 2:00pm", always Europe/London. A club
plays where the club is, and checking your fixtures from a hotel in Spain
should not shift the time you actually turn up at. Verified across the
BST/GMT boundary both ways. `formatMatchDate` covers past results.

Next Up had **three separate faults**: it showed a first name (ambiguous in a
club with two Charlies, on the one line telling you who to turn up against),
it printed the raw stored value, and it used `.find()` on an unsorted array —
so "next up" could be three weeks out while a match tomorrow sat below it.
All three fixed, and Coming up sorts now too.

Under the name, what the app reckons, in your words, banded coarsely on the
existing prediction. Wide bands on purpose: nobody wants a different sentence
for 61% and 62%, and that precision would pretend to a confidence the model
does not have. A first meeting gets its own line rather than being dressed up
as a coin flip. The prediction engine is read and never written to.

**One deviation:** the 35–44 band is specced as "Rally says {n}%. Rally's
been wrong before." but the percentage already renders beside the line in
lime for every band, so it reads "Rally's been wrong before. 42%" rather than
saying 42% twice.

### Phase 8 — no emojis · **done, one part blocked**

`components/ui/Glyph.tsx` maps every legacy glyph to a drawn lucide icon,
used by the feed, the help guide, the notification bell, the season summary,
the trophy wall and the weekly recap. An unrecognised glyph draws **nothing**
rather than a generic shape: a wrong icon is worse than none, and a gap is
visible enough to get reported.

Translating at the point of drawing also solved the awkward part.
Achievements and notifications label themselves with a character and both
live in `src/core/`, which this brief puts off limits — rightly, it is the
ratings engine and should not know what a screen looks like. Their strings
are untouched. The emoji were never really data anyway; they were a rendering
decision that had leaked a layer down.

Decorative ones next to a label that already said the same thing were simply
removed. **Left deliberately:** the arrow, tick and cross characters. They
render in the page font on every platform, which is the opposite of the
problem emoji cause.

**Blocked, and it is the one you raised yourself:** the emoji avatars in
`theme.ts AVATARS`. Replacing the picker is easy; the trouble is that
existing players have an emoji **stored on their row**, this brief forbids
editing existing player rows, and `Avatar` renders that stored character
directly. So changing the list alone would leave a club split between drawn
avatars and emoji ones, which is worse than either. Doing it properly needs a
drawn set, a change to `Avatar`, and a migration for the stored values.

---

## PHASE CHECKLIST

| Phase | State |
|---|---|
| 0 — Diagnose | **done** — item 2 blocked, no DB access |
| 1 — Results save onto the booking | **done**, adapted to the fixtures model |
| 2 — Nothing lingers on Fixtures | **done** |
| 3 — Cancel an upcoming match | **done** — opponent notification blocked |
| 4 — Add players while logging | **done** — cross-league duplicate check not possible |
| 5 — League invites | **done** — built on the join code; no expiry or single use |
| 6 — No league gate | **partial** — screen done, league-less Home blocked |
| 7 — Dates and Next Up | **done** |
| 8 — No emojis | **done** — avatar emoji blocked |

Every phase is a separate commit on `fix/booking-flow`. Nothing pushed,
merged or deployed. Typecheck clean, 268 tests passing, production build
succeeds.

---

## SQL FOR SAM TO RUN

Neither has been run. Neither is required for anything already working.

**1. `supabase/schema_fixture_delete_participants.sql`** — lets the two
people in a fixture remove it. Without it, Cancel match works for league
staff only; a participant's attempt fails visibly rather than silently.

**2. Soft cancel — not written, needs your call first.** It would be:

```sql
alter table public.fixtures add column if not exists cancelled_at timestamptz;
alter table public.fixtures add column if not exists cancelled_by text;
```

Additive, and it deletes nothing. But it only pays off alongside the code
that keeps the row instead of deleting it and filters it out everywhere —
and until that ships, cancelling would break. Say the word and I will do all
three parts together.

---

## THINGS I COULD NOT DO FROM HERE

**Diagnosis item 2 needs you.** Paste this and I will finish it:

```sql
select id, status, winner, score, league_id, date, created_at
from public.matches order by created_at desc limit 10;
```

Best theory from the code: the result **did** save but was **dated to the
booking**, because `resolveFixture` takes the match date from the fixture's
`booked` value. A fixture booked in the future produces a future-dated match
— absent from "this month", sorted somewhere you would not look, and
indistinguishable from "it didn't save".

**The preview server could not start in this session.** It is still pointed
at the old OneDrive directory and runs a stale `package.json`, so **none of
tonight's work has been looked at on screen** — only typechecked, tested and
built. Given how often looking at the screen has caught things in this
project that reasoning missed, that is the largest caveat on all of it.
Reopening Claude Code on `C:\dev\rally` should fix it, and it is the first
thing worth doing.
