import { computeDoubles, DOUBLES_PROVISIONAL_GAMES, type DoublesMatch, type DoublesStats } from "./elo";

/**
 * Who is where on the doubles table — ONE ordering, used by the Table, the
 * Home card and the weekly movement arrow.
 *
 * It lives here because it used to live in two places that disagreed: the
 * Table broke a tie on wins and then name, and the Home card broke it on
 * nothing, so two players level on rating could each be told a different
 * place depending on which screen they looked at.
 *
 * Ranked on the ROUNDED rating, deliberately — see StandingsList and §10:
 * two players printing the same number are treated as level and separated by
 * something visible (wins), not by a decimal nobody can see. Name orders but
 * is last, so the order is stable.
 *
 * Provisional players (under DOUBLES_PROVISIONAL_GAMES) are not placed at all,
 * for the reason the Table gives: a place number is a claim this app only
 * makes on five matches.
 */

export interface Named { id: string; name?: string }

export function rankedDoubles(stats: DoublesStats, players: Named[]): string[] {
  return players
    .filter((p) => (stats.played[p.id] || 0) >= DOUBLES_PROVISIONAL_GAMES)
    .sort((a, b) =>
      (Math.round(stats.elo[b.id] ?? 0) - Math.round(stats.elo[a.id] ?? 0)) ||
      ((stats.won[b.id] || 0) - (stats.won[a.id] || 0)) ||
      (a.name || "").localeCompare(b.name || ""))
    .map((p) => p.id);
}

/** 1-based place, or null for anybody not placed (provisional or unplayed). */
export function doublesPlace(stats: DoublesStats, players: Named[], id: string): number | null {
  const i = rankedDoubles(stats, players).indexOf(id);
  return i < 0 ? null : i + 1;
}

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Places gained in the last seven days: positive climbed, negative dropped,
 * zero held — the same convention as singles' MovementIndicator.
 *
 * SINGLES HAS TO REMEMBER THIS AND DOUBLES DOES NOT. Singles standings mix in
 * things that cannot be replayed, so core/snapshots.ts stores a weekly
 * picture. Doubles ratings are derived purely from the matches, so last
 * week's table is simply the replay of every match played before a week ago
 * — exact, with nothing stored and nothing to go stale.
 *
 * Null when either end has no place: somebody who became ranked this week
 * has not "moved from" anywhere, and an arrow would claim they had.
 *
 * Note the one honest edge: a result backdated into last week changes what
 * "a week ago" was. That is correct — the table a week ago really would have
 * looked like that had the result been entered on time.
 */
export function doublesMovement(
  matches: DoublesMatch[], players: Named[], id: string, now: number = Date.now(),
): number | null {
  const then = computeDoubles(matches.filter((m) => m.playedAt <= now - WEEK_MS));
  const nowStats = computeDoubles(matches.filter((m) => m.playedAt <= now));
  const before = doublesPlace(then, players, id);
  const after = doublesPlace(nowStats, players, id);
  if (before === null || after === null) return null;
  return before - after;
}
