import { DOUBLES_START, type DoublesMatch, type DoublesSlot, type DoublesStats } from "./elo";

/**
 * Everything the doubles profile lists, from one pass — the doubles
 * counterpart of matchQuality.ts's "two presentations of one computation".
 *
 * History, Best wins and Record against are three views of the same rows, so
 * they cannot disagree about what a match was: the win Best wins shows is the
 * same row History shows, with the same rating beside it.
 *
 * CONFIRMED ONLY, as every number in the app counts. §7 records what it cost
 * when one list on the singles profile forgot that.
 */

const counts = (m: DoublesMatch): boolean =>
  m.status === undefined || m.status === "confirmed";

export type Outcome = "w" | "d" | "l";

export interface DoublesHistoryRow {
  match: DoublesMatch;
  /** Which side of the net you were on — team A's games are always `a`. */
  onA: boolean;
  /** Null when your partner was somebody nobody could name. */
  partner: DoublesSlot;
  opponents: [DoublesSlot, DoublesSlot];
  outcome: Outcome;
  /** Your rating change from this match, as the engine recorded it. */
  delta: number | null;
  /**
   * The opposing pair's average doubles rating walking on court — measured,
   * not claimed. An unknown opponent is DOUBLES_START, the number the engine
   * itself used for them.
   */
  oppRating: number;
}

/** Your doubles matches, newest first. */
export function doublesHistory(matches: DoublesMatch[], stats: DoublesStats, playerId: string): DoublesHistoryRow[] {
  // Index the deltas once rather than searching them per row per player.
  const before = new Map<string, number>();
  const change = new Map<string, number>();
  for (const d of stats.deltas) {
    before.set(d.matchId + "|" + d.playerId, d.before);
    change.set(d.matchId + "|" + d.playerId, d.delta);
  }
  const ratingThen = (matchId: string, id: DoublesSlot): number =>
    id == null ? DOUBLES_START : before.get(matchId + "|" + id) ?? DOUBLES_START;

  const rows: DoublesHistoryRow[] = [];
  for (const m of matches) {
    if (!counts(m)) continue;
    const onA = m.teamA.includes(playerId);
    const onB = !onA && m.teamB.includes(playerId);
    if (!onA && !onB) continue;
    const mine = onA ? m.teamA : m.teamB;
    const theirs = onA ? m.teamB : m.teamA;
    const partner = mine[0] === playerId ? mine[1] : mine[0];
    const outcome: Outcome = m.winner === "draw" ? "d" : (m.winner === "A") === onA ? "w" : "l";
    rows.push({
      match: m,
      onA,
      partner,
      opponents: [theirs[0], theirs[1]],
      outcome,
      delta: change.get(m.id + "|" + playerId) ?? null,
      oppRating: (ratingThen(m.id, theirs[0]) + ratingThen(m.id, theirs[1])) / 2,
    });
  }
  return rows.sort((a, b) => (b.match.playedAt - a.match.playedAt) || (a.match.id < b.match.id ? 1 : -1));
}

/**
 * Your best wins: against the strongest pairs, as they stood at the time.
 *
 * Ranked on the pair's rating THEN, not now — the same principle as levelAt
 * on singles: a win is judged on who they were when you played them, and a
 * pair that has since collapsed does not retroactively cheapen it.
 */
export function bestDoublesWins(history: DoublesHistoryRow[], n = 3): DoublesHistoryRow[] {
  return history
    .filter((r) => r.outcome === "w")
    .slice()
    .sort((a, b) => (b.oppRating - a.oppRating) || (b.match.playedAt - a.match.playedAt))
    .slice(0, n);
}

export interface OpponentRecord {
  opponentId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
}

/**
 * Your record against each PERSON you have faced — not each pair.
 *
 * Pairs were considered and rejected for the reason predictDoubles gives:
 * with four people a match, pairings multiply while matches do not, so most
 * pair-against-pair records are a single game. Against a person, a club
 * builds up a real number. An unknown opponent is nobody, and is skipped.
 */
export function opponentRecords(history: DoublesHistoryRow[]): OpponentRecord[] {
  const acc = new Map<string, OpponentRecord>();
  for (const r of history) {
    for (const id of r.opponents) {
      if (id == null) continue;
      const row = acc.get(id) || { opponentId: id, played: 0, won: 0, drawn: 0, lost: 0 };
      row.played++;
      if (r.outcome === "w") row.won++;
      else if (r.outcome === "l") row.lost++;
      else row.drawn++;
      acc.set(id, row);
    }
  }
  return Array.from(acc.values()).sort((a, b) =>
    (b.played - a.played) || (b.won - a.won) || (a.opponentId < b.opponentId ? -1 : 1));
}

/**
 * Your overall doubles win rate, counted the way the Partners card counts a
 * partnership (a draw is half), so "with Charlie" and "overall" are the same
 * quantity and can be compared.
 */
export function overallWinRate(history: DoublesHistoryRow[]): number {
  if (!history.length) return 0;
  const pts = history.reduce((s, r) => s + (r.outcome === "w" ? 1 : r.outcome === "d" ? 0.5 : 0), 0);
  return pts / history.length;
}
