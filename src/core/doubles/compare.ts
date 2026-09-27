import { computeDoubles, isProvisional, predictDoubles, previewDoubles, type DoublesMatch, type DoublesStats } from "./elo";

/**
 * Compare, for doubles: two PAIRS side by side, and who would win.
 *
 * Sam, 27 Sep 2026: "if ur in doubles then compare u can compare 2 v 2 to see
 * what teams would win and stats".
 *
 * The prediction is predictDoubles — the doubles rating and nothing else — so
 * this screen and a booked fixture's odds cannot disagree, and neither can the
 * "if you win" swing, which is previewDoubles replaying the real history with
 * the match appended: exactly what saving the result would do.
 *
 * Everything else is description, not input to the prediction. That is the
 * doubles rule in elo.ts: pair-versus-pair records are mostly zero or one
 * match, which is noise that would swamp the rating if it were blended in.
 * They are still worth SHOWING — "you two have beaten them twice" is the
 * first thing anybody wants to know — just not worth betting on.
 *
 * Confirmed matches only, like every doubles number.
 */

export type Pair = [string, string];
export type WDL = { w: number; d: number; l: number };

const counts = (m: DoublesMatch) => m.status === undefined || m.status === "confirmed";
const samePair = (t: [string, string | null], p: Pair) =>
  (t[0] === p[0] && t[1] === p[1]) || (t[0] === p[1] && t[1] === p[0]);
const onTeam = (t: [string, string | null], id: string) => t[0] === id || t[1] === id;

export interface PlayerLine {
  id: string;
  rating: number;
  played: number;
  record: WDL;
  provisional: boolean;
}

export interface TeamView {
  pair: Pair;
  /** The team's rating: the average of the two, which is what the odds use. */
  rating: number;
  /** As a pair — the two of them on the same side. */
  together: WDL & { played: number };
  /** Their last five together, oldest first. */
  form: Array<"W" | "D" | "L">;
  players: [PlayerLine, PlayerLine];
}

export interface Crossing {
  /** Team A's player and team B's player. */
  a: string;
  b: string;
  /** A's record against B whenever they were on opposite sides, any partners. */
  record: WDL;
}

export interface TeamComparison {
  stats: DoublesStats;
  /** Team A's chance, 0–100. */
  chanceA: number;
  teams: [TeamView, TeamView];
  /** These exact pairs against each other, from team A's side, newest first. */
  meetings: WDL & { matches: DoublesMatch[] };
  /** What each player's rating would do. */
  swing: { ifA: Record<string, number>; ifB: Record<string, number> };
  crossings: Crossing[];
}

export function compareTeams(matches: DoublesMatch[], a: Pair, b: Pair, now: number = Date.now()): TeamComparison {
  const stats = computeDoubles(matches);
  const confirmed = matches.filter(counts).sort((x, y) => x.playedAt - y.playedAt || (x.id < y.id ? -1 : 1));

  const line = (id: string): PlayerLine => ({
    id,
    rating: Math.round(stats.elo[id] ?? 1500),
    played: stats.played[id] || 0,
    record: { w: stats.won[id] || 0, d: stats.drawn[id] || 0, l: stats.lost[id] || 0 },
    provisional: isProvisional(stats, id),
  });

  const team = (p: Pair): TeamView => {
    const results: Array<"W" | "D" | "L"> = [];
    for (const m of confirmed) {
      const side = samePair(m.teamA, p) ? "A" : samePair(m.teamB, p) ? "B" : null;
      if (!side) continue;
      results.push(m.winner === "draw" ? "D" : m.winner === side ? "W" : "L");
    }
    const r = (k: "W" | "D" | "L") => results.filter((x) => x === k).length;
    const [l0, l1] = [line(p[0]), line(p[1])];
    return {
      pair: p,
      rating: Math.round((l0.rating + l1.rating) / 2),
      together: { played: results.length, w: r("W"), d: r("D"), l: r("L") },
      form: results.slice(-5),
      players: [l0, l1],
    };
  };

  // Pair against pair, whichever way round they were written down.
  const met: DoublesMatch[] = [];
  const mrec: WDL = { w: 0, d: 0, l: 0 };
  for (const m of confirmed) {
    const aSide = samePair(m.teamA, a) && samePair(m.teamB, b) ? "A" : samePair(m.teamB, a) && samePair(m.teamA, b) ? "B" : null;
    if (!aSide) continue;
    met.push(m);
    if (m.winner === "draw") mrec.d++; else if (m.winner === aSide) mrec.w++; else mrec.l++;
  }

  // Each of A's players against each of B's, on opposite sides of the net
  // with anybody as partner — the part a pair record is too thin to show.
  const crossings: Crossing[] = [];
  for (const x of a) for (const y of b) {
    const rec: WDL = { w: 0, d: 0, l: 0 };
    for (const m of confirmed) {
      const xSide = onTeam(m.teamA, x) && onTeam(m.teamB, y) ? "A" : onTeam(m.teamB, x) && onTeam(m.teamA, y) ? "B" : null;
      if (!xSide) continue;
      if (m.winner === "draw") rec.d++; else if (m.winner === xSide) rec.w++; else rec.l++;
    }
    crossings.push({ a: x, b: y, record: rec });
  }

  const swingFor = (winner: "A" | "B") => {
    const out: Record<string, number> = {};
    previewDoubles(matches, { teamA: a, teamB: b, winner, playedAt: now }).forEach((d) => { out[d.playerId] = d.delta; });
    return out;
  };

  return {
    stats,
    chanceA: Math.round(predictDoubles(a, b, stats) * 100),
    teams: [team(a), team(b)],
    meetings: { ...mrec, matches: met.reverse() },
    swing: { ifA: swingFor("A"), ifB: swingFor("B") },
    crossings,
  };
}
