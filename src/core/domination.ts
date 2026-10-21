import { gameTotals, parseSets } from "./sets";

/**
 * The headline for a one-sided result (winter brief item 7): games won over
 * games played across every set, partial sets included — the score as
 * written, read against the recorded winner like everything in core/sets.ts.
 *
 *   75% or more  "Zaach dominates Sam · 10–2"
 *   90% or more  "Zaach demolishes Sam · 12–1"
 *
 * Null for anything closer, for a draw, for no score, and for a score that
 * can't be squared with the result. Also null under MIN_GAMES: a 3-0 knock-up
 * is not a demolition of anybody, whatever its percentage.
 */
export const DOMINATES = 0.75;
export const DEMOLISHES = 0.9;
export const MIN_GAMES = 6;

export function dominationHeadline(
  match: { p1: string; p2: string; winner: string; score?: string | null },
  nameOf: (id: string) => string,
): string | null {
  if (match.winner !== "p1" && match.winner !== "p2") return null;
  const sets = parseSets(match.score);
  if (!sets) return null;
  const t = gameTotals(sets);
  if (t.a === t.b) return null;
  const won = Math.max(t.a, t.b), lost = Math.min(t.a, t.b);
  if (won + lost < MIN_GAMES) return null;
  const share = won / (won + lost);
  if (share < DOMINATES) return null;
  const winner = match.winner === "p1" ? match.p1 : match.p2;
  const loser = match.winner === "p1" ? match.p2 : match.p1;
  const verb = share >= DEMOLISHES ? "demolishes" : "dominates";
  return `${nameOf(winner)} ${verb} ${nameOf(loser)} · ${won}–${lost}`;
}
