/**
 * "Count this as a league game?" — a result logged with + between two
 * players who still owe each other a competition match.
 *
 * Sam, 2026-10-21: "Players will log with + out of habit, and the league
 * table will quietly miss games." A competition only counts results entered
 * on its ties, which is right — a hungover friendly with George must not
 * count — but nothing used to ask. Now Log a result asks, and the player
 * decides; nothing is attached without a yes.
 *
 * Pure: no React, no Supabase.
 */

export interface TieLike {
  id: string; p1?: string | null; p2?: string | null;
  done?: boolean; outcome?: string | null; matchId?: string | null;
  competitionId?: string | null; round?: number | null;
}
export interface CompetitionLike { id: string; format?: string; status?: string }
export interface MatchLike { id: string; p1: string; p2: string; winner: string }

/**
 * The open competition ties between these two, earliest round first. Open
 * means no result, no walkover, not void, in a competition still running.
 * A draw can't settle a knockout tie, so for a draw those are left out.
 */
export function openTiesBetween(
  fixtures: TieLike[], competitions: CompetitionLike[], a: string, b: string, isDraw = false,
): TieLike[] {
  const comp = new Map(competitions.map((c) => [c.id, c]));
  return fixtures
    .filter((f) => {
      if (!f.competitionId || f.done || f.outcome) return false;
      const c = comp.get(f.competitionId);
      if (!c || c.status === "finished") return false;
      if (isDraw && c.format === "knockout") return false;
      return (f.p1 === a && f.p2 === b) || (f.p1 === b && f.p2 === a);
    })
    .sort((x, y) => (x.round ?? 0) - (y.round ?? 0));
}

/** One option per competition: its earliest open tie, and how many are left. */
export function leagueGameOptions(
  fixtures: TieLike[], competitions: CompetitionLike[], a: string, b: string, isDraw = false,
): Array<{ tie: TieLike; left: number }> {
  const byComp = new Map<string, TieLike[]>();
  for (const t of openTiesBetween(fixtures, competitions, a, b, isDraw)) {
    const list = byComp.get(t.competitionId!) || [];
    list.push(t);
    byComp.set(t.competitionId!, list);
  }
  return [...byComp.values()].map((ts) => ({ tie: ts[0], left: ts.length }));
}

/**
 * The tie, settled by this match. The fixture's winner is written in the
 * FIXTURE's orientation: the match may name the players the other way round
 * (you logged "Charlie v Sam" against a "Sam v Charlie" tie).
 */
export function settleTie<T extends TieLike>(tie: T, match: MatchLike): T & { done: true; winner: string; matchId: string; booked: null } {
  let winner = match.winner;
  if (winner !== "draw") {
    const winnerId = winner === "p1" ? match.p1 : match.p2;
    winner = winnerId === tie.p1 ? "p1" : "p2";
  }
  return { ...tie, done: true, winner, matchId: match.id, booked: null };
}
