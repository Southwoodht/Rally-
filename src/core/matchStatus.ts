/**
 * What a match's status means — in one place, for the first time.
 *
 * Until now every consumer asked the same question by hand, and all 35 of
 * them asked it the same wrong way: `m.status !== "pending"`. That is a
 * denylist. It answers "is this played?" with "well, it isn't the one status
 * I know about", so **any status nobody had thought of yet counted as a
 * played match** — in the ratings, the table, Official, H2H, the feed,
 * achievements, streaks, rivalries, predictions and the tiebreak.
 *
 * That was survivable while `confirmed` and `pending` were the only two
 * values. Booking adds five more — proposed, scheduled, awaiting, cancelled,
 * declined — and every one of them describes a match with no result. Under
 * the old test all five would have been counted as played, and two places
 * would have gone further than counting them:
 *
 *   - `elo.ts` decides the score with `if p1 … else if p2 … else`, and that
 *     bare `else` scores a missing winner as a **genuine draw** — half a
 *     point of Elo each, a D in both form strings and both records.
 *   - `official.ts` guards with `winner !== "draw"`, and `null !== "draw"`
 *     is **true**, so a resultless row passes the guard and then credits
 *     whoever happens to sit in p2 with a quality win.
 *
 * So the fix has to land before the statuses do, not alongside them.
 *
 * **This module changes no existing behaviour.** For every value that exists
 * in the database today it answers exactly what `!== "pending"` answered:
 * matches only ever carry `confirmed` or `pending` (checked across the app
 * and the SQL — `accepted`, `approved` and `rejected` belong to threads and
 * trophies, not here). What it adds is that the five new booking statuses
 * are excluded by name, and that a status nobody recognises says so out loud
 * instead of quietly joining the ratings.
 */

/** Booked, or abandoned. No winner, no score, nothing to rate. */
const NOT_PLAYED = new Set([
  "proposed",   // waiting on the opponent to accept
  "scheduled",  // agreed, still to come
  "awaiting",   // the time has passed, nobody has entered a result
  "cancelled",  // it didn't happen
  "declined",   // the proposal was turned down
]);

/**
 * A result exists, the opponent hasn't agreed it yet.
 *
 * `pending` is the name this has always had; `reported` is the name the
 * booking flow gives it. They are the same state and both are listed here so
 * the rename can happen without a data migration and without a moment where
 * one of them is unrecognised.
 */
const UNCONFIRMED = new Set(["pending", "reported"]);

/**
 * How long a result waits for the opponent before it confirms itself. 48
 * hours since 2026-10-21 (Sam: "24 is too tight for people who check the app
 * twice a week"); it was 24.
 */
export const CONFIRM_WINDOW_MS = 48 * 3600 * 1000;

/**
 * A result the opponent disputed. It counts for nothing until an organiser
 * keeps it or removes it — the dispute used to delete the match outright,
 * which let one person wipe a match they lost (Sam, 2026-10-21).
 */
const DISPUTED = "disputed";

/**
 * A short or unfinished match (winter brief item 9): a quick 3-0 that wasn't
 * a full set. Shown in the feed and head-to-head, labelled, and counted in
 * nothing — no rating, no table, no competition — so nobody can farm points
 * with them. Never asks the opponent to agree: there is nothing to agree to.
 */
const SHORT = "short";

/**
 * A legacy result (Sam, 2026-10-25): a match from before anyone logged them —
 * "I dominated two players pre 2020 and couldn't tell you how many games, it
 * was all the time". Recorded so the history is true, counted in NOTHING:
 * no rating, table, Official, prediction, streak, achievement or
 * competition. A status rather than a flag on a confirmed row, on purpose:
 * every rating already asks countsAsPlayed, and the Global table's SQL counts
 * only `confirmed`, so a status cannot leak into a rating anyone forgot to
 * update. Often dated to the year only (`datePrecision: "year"`).
 */
const LEGACY = "legacy";
/**
 * A legacy result one side has claimed and the other has not yet agreed
 * (Sam, 2026-10-30: "the opponent must confirm a legacy entry; unconfirmed
 * shows as claimed"). Counted in nothing, exactly like `legacy`, and NEVER
 * swept to agreed by the 48-hour timer: a claim about 2018 is not something
 * silence can settle. Agreeing turns it into `legacy`, never `confirmed`.
 */
const LEGACY_CLAIMED = "legacy_claimed";

const warned = new Set<string>();

/**
 * Does this match count as played — in ratings, records, tables, everything
 * that treats a match as a fact about who is better?
 *
 * **Unconfirmed results count.** This reversed on 2026-09-10, and it is the
 * reversal of a real earlier decision, so here is both halves.
 *
 * They used to be excluded, and the argument was that a tile and the list
 * behind it must agree. That still holds — it is why `isAgreed` exists
 * below — but excluding them solved it at the wrong end. The match happened.
 * Somebody played it, somebody wrote it down, and the app then declined to
 * count it until a second person tapped a button. That is what produced
 * Sam counting 31 wins against a tile saying 28: his mental model was right
 * and the app's was the odd one.
 *
 * Measured before flipping, per the numbers-first rule: zero pending matches
 * existed in production, so nothing moved on the day. What changes from here
 * is that a result you log is yours immediately rather than tomorrow.
 *
 * The chip stays. Counting a result and flagging that nobody has agreed it
 * are different jobs, and the row does both.
 */
export function countsAsPlayed(m: any): boolean {
  const s = m?.status;
  if (NOT_PLAYED.has(s)) return false;
  if (s === DISPUTED || s === SHORT || s === LEGACY || s === LEGACY_CLAIMED) return false;
  if (UNCONFIRMED.has(s)) return true;
  if (s === "confirmed") return true;
  // Unknown. Behave exactly as the old denylist did rather than silently
  // dropping real results out of the ratings — but say so, because a status
  // this file has never heard of is a bug somewhere and it should be
  // findable rather than absorbed.
  if (s && !warned.has(s)) {
    warned.add(s);
    console.warn(`matchStatus: unrecognised match status "${s}" — counting it as played, as the old check did. Add it to core/matchStatus.ts.`);
  }
  return true;
}

/** A result exists — agreed or not. The lists that show pending, marked. */
export function hasResult(m: any): boolean {
  return countsAsPlayed(m) || UNCONFIRMED.has(m?.status);
}

/**
 * Both sides have agreed this result.
 *
 * Narrower than `countsAsPlayed`, and the difference matters wherever
 * agreed and unagreed results are shown as two separate lists — use this for
 * the "confirmed" half, or a pending match appears in both at once.
 */
export function isAgreed(m: any): boolean {
  return m?.status === "confirmed";
}

/** Somebody entered a result and the other side hasn't agreed it yet. */
export function isUnconfirmedResult(m: any): boolean {
  return UNCONFIRMED.has(m?.status);
}

/** Booked but not played: proposed, scheduled or awaiting a result. */
export function isBooking(m: any): boolean {
  return NOT_PLAYED.has(m?.status);
}

/**
 * Is there a real person behind this player row?
 *
 * `auth_id` is the only identity this app trusts — never a name match, for
 * reasons written up at length in CLAUDE.md §3. It decides whether booking
 * against somebody is a proposal they must accept, or simply a booking:
 * there is nobody to accept on behalf of a shell.
 *
 * Known wrinkle it cannot see: §7's orphaned account rows, where a glitch
 * left an auth_id on a new empty player row while the person's real record
 * sits on an unclaimed shell. Such a row reads as claimed and is, technically
 * — it just isn't the row that person plays under. Booking against it would
 * propose to somebody who never sees it. Nothing here can detect that; it is
 * fixed by deleting the empty row, not by guessing here.
 */
export function isClaimed(player: any): boolean {
  return !!player?.auth_id;
}

/** Disputed by the opponent, waiting for an organiser. Counts for nothing. */
export function isDisputed(m: any): boolean {
  return m?.status === DISPUTED;
}

/** A short or unfinished match: shown, labelled, never counted. */
export function isShortMatch(m: any): boolean {
  return m?.status === SHORT;
}

/** A legacy result: in the history and the head-to-head, labelled, counted in nothing. */
export function isLegacy(m: any): boolean {
  return m?.status === LEGACY || m?.status === LEGACY_CLAIMED;
}

/** A legacy result the other side has not agreed yet: shown as "claimed". */
export function isLegacyClaimed(m: any): boolean {
  return m?.status === LEGACY_CLAIMED;
}

/**
 * Who has to agree a legacy result before it stops being a claim: anybody
 * in it with an account who did not log it. Nobody — a shell, or the
 * reporter alone — and it is simply recorded, as with any other result.
 */
export function legacyNeedsAgreement(p1: any, p2: any, reporterPlayerId: string | null | undefined): boolean {
  return [p1, p2].some((p) => p && p.id !== reporterPlayerId && isClaimed(p));
}

/**
 * The line under a head-to-head record about the years before Southwood:
 * "Led 4 legacy years", "Led 3 of 4 legacy years", "Trailed 2 legacy
 * years", "Level over 2 legacy years". From the side of whoever w/l is
 * counted for; a draw year leads nobody. Claimed years are counted in and
 * named, so a claim is never presented as agreed. Null with no legacy.
 */
export function legacyLine(r: { w: number; d: number; l: number; claimed?: number }): string | null {
  const n = r.w + r.d + r.l;
  if (!n) return null;
  const years = (k: number) => (k === n ? `${n} legacy ${n === 1 ? "year" : "years"}` : `${k} of ${n} legacy years`);
  const main = r.w > r.l ? "Led " + years(r.w) : r.l > r.w ? "Trailed " + years(r.l) : `Level over ${n} legacy ${n === 1 ? "year" : "years"}`;
  return r.claimed ? `${main} · ${r.claimed} claimed` : main;
}
