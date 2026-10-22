/**
 * The singles ladder.
 *
 * Sam, 2026-10-22: Seacourt's ladder is a wooden board in the clubhouse with
 * paper names on it, singles and doubles mixed together. Few play singles, so
 * doubles players sit high on a board that is meant to be about singles —
 * Zaach can be below people who would never play him at singles. This is a
 * singles-only ladder in the app.
 *
 * The rules are the ones every club ladder uses:
 *   - you challenge someone up to LADDER_REACH places above you;
 *   - if you win, you take their place and everyone from them down to where
 *     you were moves down one; if they win, or it is a draw, nothing moves;
 *   - one open challenge per player at a time, as challenger or defender,
 *     and it is to be played within LADDER_DAYS;
 *   - a newcomer joins at the bottom.
 *
 * Storage is the competitions machinery, with nothing new to keep in step: a
 * ladder is a singles competition with format "ladder", its entries' seeds
 * are the starting order, and every challenge is a competition tie (a
 * fixture) whose p1 is the challenger. The order is never stored. It is
 * replayed from the starting order and the decided challenges, oldest first,
 * so correcting a result corrects the ladder — the same rule as every table.
 *
 * Pure: no React, no Supabase.
 */

export const LADDER_REACH = 3;
export const LADDER_DAYS = 14;

export interface LadderEntry { id: string; p1: string; seed: number; createdAt?: number }

/** A challenge as the ladder reads it: who challenged whom, and how it ended. */
export interface LadderChallenge {
  id: string;
  /** Player ids. The challenger is always the fixture's p1. */
  challenger: string;
  defender: string;
  /** "challenger" | "defender" | "draw" once decided; null while open or void. */
  result: "challenger" | "defender" | "draw" | null;
  /** When it was decided, for ordering the replay. */
  at: number;
  /** Creation order, the tiebreak when two were decided on the same day. */
  round?: number | null;
  open: boolean;
}

/** The starting order: seed, then who was added first. */
function startOrder(entries: LadderEntry[]): string[] {
  return [...entries]
    .sort((a, b) => a.seed - b.seed || (a.createdAt ?? 0) - (b.createdAt ?? 0))
    .map((e) => e.p1);
}

/**
 * Who is where now: player ids, top first.
 *
 * A challenge between two people who are no longer both on the ladder is
 * skipped (somebody left), and so is a win by a challenger who was already
 * above the defender by then — the result stands as a match, it just moves
 * nobody. Late joiners are simply further down the starting order: a move
 * only ever shifts the places between the challenger and the defender, so
 * someone at the bottom is never disturbed by a challenge above them.
 */
export function ladderOrder(entries: LadderEntry[], challenges: LadderChallenge[]): string[] {
  const order = startOrder(entries);
  const decided = challenges
    .filter((c) => c.result === "challenger")
    .sort((a, b) => a.at - b.at || (a.round ?? 0) - (b.round ?? 0));
  for (const c of decided) {
    const from = order.indexOf(c.challenger), to = order.indexOf(c.defender);
    if (from < 0 || to < 0 || from <= to) continue;
    order.splice(from, 1);
    order.splice(to, 0, c.challenger);
  }
  return order;
}

/** Who is in an open challenge right now — they can neither challenge nor be challenged. */
export function busyPlayers(challenges: LadderChallenge[]): Set<string> {
  const out = new Set<string>();
  for (const c of challenges) if (c.open) { out.add(c.challenger); out.add(c.defender); }
  return out;
}

/**
 * Why `me` cannot challenge `target`, in words, or null if they can.
 * The screen shows the button only when this is null.
 */
export function challengeProblem(order: string[], challenges: LadderChallenge[], me: string, target: string): string | null {
  const mine = order.indexOf(me), theirs = order.indexOf(target);
  if (mine < 0) return "Join the ladder first.";
  if (theirs < 0 || me === target) return "They are not on the ladder.";
  if (theirs >= mine) return "You can only challenge people above you.";
  if (mine - theirs > LADDER_REACH) return `You can challenge up to ${LADDER_REACH} places above you.`;
  const busy = busyPlayers(challenges);
  if (busy.has(me)) return "Finish your open challenge first.";
  if (busy.has(target)) return "They already have a challenge to play.";
  return null;
}
