# Doubles: how to add it later without a rewrite

Not built. This is the plan for when it's time, written down now so it's a
decision, not a thing that gets forgotten.

## Why it's not a quick add

Every match in Rally is `{ p1, p2, winner: "p1"|"p2"|"draw", ... }` — one
player per side. That assumption is baked into nearly everything:

- `core/elo.ts` — rating updates read `m.p1`/`m.p2` directly
- `core/official.ts`, `core/rank.ts` — official ranking, streaks, per-match
  ELO-before/after replay
- `core/achievements.ts`, `core/season.ts`, `core/legacy.ts`,
  `core/rivalries.ts` — all keyed on one player vs one opponent
- Every UI surface that logs, edits, displays, or claims a match — LogResult,
  MatchDetail, History, RecordBody, HeadToHead, PlayerPicker

Changing `p1`/`p2` into team arrays touches essentially all of that. Doing
it under time pressure right before real data goes live is exactly the kind
of change that risks silently corrupting real matches — not worth it for a
feature nobody's asked to use yet.

## The recommended path when it's time

**Keep doubles completely separate from singles, rather than generalizing
the existing match model.** Most real clubs think about it this way anyway
— your singles ELO and your doubles ELO are different things, not the same
number split two ways.

Concretely:

- A new match shape for doubles: `{ team1: [idA, idB], team2: [idC, idD], winner, date, ... }`,
  stored separately from `matches` (e.g. `doublesMatches` in the same
  league blob).
- New, parallel versions of the handful of core functions that need to
  understand teams — a `computeDoublesStats` alongside `computeStats`, etc.
  These mirror the existing logic, they don't replace it.
- Existing singles data, ratings, achievements, Legacy stats — completely
  unaffected. Nobody's real singles record changes shape or gets
  reinterpreted.
- Doubles gets its own lightweight UI (log a doubles result, a doubles
  table) rather than trying to force it through the existing singles
  screens.

This is more total code than trying to generalize `p1`/`p2` into arrays
everywhere, but every piece of it is additive and low-risk — nothing that
already works has to change to make room for it. That's worth the extra
line count.

## What NOT to do

Don't try to make `p1`/`p2` "just work" for doubles via some clever
composite ID (e.g. a synthetic `"team:sam+charlie"` player). It looks
tempting but corrupts the player model — that fake ID would start showing
up in individual rankings, profiles, and Legacy stats as if it were a real
player, which it isn't.
