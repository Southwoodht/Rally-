import { LEVELS } from "./constants";
import { isClaimed } from "./matchStatus";

/**
 * Booking a match: who has to agree, which league it belongs to, and when to
 * ask how it went.
 *
 * All of it pure. The screens decide what to render; this decides what is
 * true, and it is tested rather than trusted.
 */

// ---------------------------------------------------------------- statuses

export type BookingStatus =
  | "proposed" | "scheduled" | "awaiting"
  | "reported" | "confirmed"
  | "cancelled" | "declined";

/**
 * Where a new booking starts.
 *
 * Against a claimed player it is a *proposal* — somebody real has to agree to
 * give up an evening, and an app that puts a match in their diary without
 * asking is an app that arranges their week for them.
 *
 * Against an unclaimed shell there is nobody to ask, so waiting for an accept
 * that can never arrive would just be a booking that never starts. It goes
 * straight to scheduled.
 */
export function initialStatus(opponent: any): BookingStatus {
  return isClaimed(opponent) ? "proposed" : "scheduled";
}

/**
 * Whether the newsfeed should announce this booking.
 *
 * Only on scheduled, never on proposed. Announcing a match the opponent
 * hasn't agreed to tells the league it is happening and puts the other person
 * in the position of having to un-announce it.
 */
export function shouldAnnounce(status: BookingStatus): boolean {
  return status === "scheduled";
}

// ------------------------------------------------------------ the league

export type LeagueChoice =
  | { kind: "single"; leagueId: string }
  | { kind: "choose"; options: string[] }
  | { kind: "friendly" };

/**
 * Which league a booking belongs to, decided when it is booked rather than
 * when it is played.
 *
 * Share exactly one league and there is nothing to ask about. Share several
 * and only the two players know which one this is for — a guess here would
 * quietly put the result in the wrong table. Share none and it is a friendly:
 * it counts in their personal records and their head-to-head, and in no
 * league table and no Official points, because it did not happen in a league.
 *
 * Deciding at booking time and not at result time is the point. The alternative
 * is a result arriving with no home and asking somebody to file it, which is a
 * question nobody wants after a match.
 */
export function resolveLeague(mine: string[], theirs: string[]): LeagueChoice {
  const theirSet = new Set(theirs);
  const shared = mine.filter((id) => theirSet.has(id));
  if (shared.length === 1) return { kind: "single", leagueId: shared[0] };
  if (shared.length > 1) return { kind: "choose", options: shared };
  return { kind: "friendly" };
}

/** A friendly counts for the two people who played it and nobody else. */
export function countsInLeagueTable(leagueId: string | null | undefined): boolean {
  return !!leagueId;
}

// ------------------------------------------------------- someone my level

/**
 * Is this player near enough my standard to be worth a game?
 *
 * Star **category** within one — not Official points, and not the 18-point
 * level value. Official is unusable for this: ten players sit on exactly 0,
 * and provisional players aren't ranked at all, so sorting by it puts a
 * stranger and a club champion side by side. The 18-point scale is too fine
 * in the other direction — level is a self-picked dropdown and half of them
 * are wrong, so "one sub-level apart" is arithmetic performed on a guess.
 *
 * A whole category either way is the honest resolution of the data.
 *
 * Takes LEVELS, not players — pass player.level, or levelNow(player). It
 * deliberately does not read a player object: a level is a claim about now,
 * and the caller should be the one deciding which claim it is asking about.
 *
 * Nobody with no level set matches anybody, in either direction. That is not
 * an oversight: they have made no claim, and putting them in a list called
 * "around your level" would be the app making one for them.
 */
export function isNearMyLevel(myLevel: any, theirLevel: any, within = 1): boolean {
  const a = categoryIndex(myLevel), b = categoryIndex(theirLevel);
  if (a === null || b === null) return false;
  return Math.abs(a - b) <= within;
}

function categoryIndex(level: any): number | null {
  const cat = level?.cat;
  if (!cat) return null;
  const i = LEVELS.indexOf(cat);
  return i < 0 ? null : i;
}

// --------------------------------------------------------- how did it go

/** Two hours, unless the booking says otherwise. */
export const DEFAULT_DURATION_MINUTES = 120;

/** A booking nobody resolves is given up on after a week — but stays editable. */
export const AUTO_CANCEL_DAYS = 7;

export function endsAt(match: any): number {
  const mins = match?.durationMinutes || DEFAULT_DURATION_MINUTES;
  return (match?.date || 0) + mins * 60000;
}

/**
 * Should Home ask "how did it go?"
 *
 * Computed here and rendered client-side, not pushed. This is a PWA: there is
 * no reliable push on iOS, so a notification that fires for some people and
 * not others is worse than a card everybody sees when they next open the app.
 */
export function needsResultPrompt(match: any, now: number = Date.now()): boolean {
  if (match?.status !== "scheduled") return false;
  return now > endsAt(match);
}

/**
 * Long enough past that nobody is going to enter it.
 *
 * The booking is cancelled, not deleted, and stays editable: "we never played"
 * and "I forgot to write it down" look identical from here, and only one of
 * them means the match didn't happen.
 */
export function shouldAutoCancel(match: any, now: number = Date.now()): boolean {
  if (!needsResultPrompt(match, now)) return false;
  return now > endsAt(match) + AUTO_CANCEL_DAYS * 86400000;
}

// ------------------------------------------------------- result agreement

/**
 * What happens when somebody enters a result.
 *
 * Against an unclaimed opponent it is final — there is nobody who could
 * disagree, and leaving it unconfirmed forever would mark it with a chip that
 * can never be cleared.
 *
 * Against a claimed opponent the first submission stands and the other side
 * confirms or disputes it. A dispute is never resolved automatically: two
 * people disagreeing about what happened is not something an app can settle,
 * and picking a side would make it the app's error rather than theirs.
 */
export function statusAfterReport(opponent: any): BookingStatus {
  return isClaimed(opponent) ? "reported" : "confirmed";
}
