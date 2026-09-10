# RALLY FIX REPORT

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

## PHASE CHECKLIST

| Phase | State |
|---|---|
| 0 — Diagnose | **done** (item 2 blocked: no DB access) |
| 1 — Results save onto the booking | pending |
| 2 — Nothing lingers on Fixtures | pending |
| 3 — Cancel an upcoming match | pending |
| 4 — Add players while logging | pending |
| 5 — League invites | pending |
| 6 — No league gate at signup | pending |
| 7 — Dates and Next Up | pending |
| 8 — No emojis | pending |

## SQL FOR SAM TO RUN

Listed here as they are written. None have been run.

1. `supabase/schema_fixture_delete_participants.sql` — lets the two people in
   a fixture remove it. Without it, the Remove control added today works for
   league staff only.
