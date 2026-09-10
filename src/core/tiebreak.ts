// Deciding who is above whom when the ranking metric can't.
//
// Before this, rankMaps() sorted on the metric alone. Array#sort is stable,
// so two players on the same score came out in whatever order the players
// array happened to be in. That is not a tie being broken — it's a tie being
// ignored, and the answer changes the moment somebody joins the league or a
// row comes back from Supabase in a different order.
//
// Nothing here touches the metric. Everything below only ever separates
// players the metric has already declared equal.

import { countsAsPlayed } from "./matchStatus";

export interface RankCandidate {
  id: string;
  /** For the final, purely presentational ordering. */
  name: string;
  /** The metric being ranked on — Official points, ELO, whatever. */
  score: number;
  w: number;
  d: number;
  l: number;
}

/** wins[a][b] = the number of times a beat b. Draws are not wins. */
export type H2HWins = Record<string, Record<string, number>>;

export interface RankedPlayer {
  id: string;
  /** 1-based. Genuinely tied players share one, and the next rank skips:
   *  3, 3, 5 — the convention every sport uses, because two people in third
   *  means nobody came fourth. */
  rank: number;
  /** True when this player shares their rank with somebody. */
  tied: boolean;
}

const gamesOf = (c: RankCandidate) => c.w + c.d + c.l;
const winRateOf = (c: RankCandidate) => {
  const gp = gamesOf(c);
  return gp ? (c.w + c.d * 0.5) / gp : 0;
};

/**
 * Head-to-head *among the tied group*, not pairwise.
 *
 * Pairwise is unsound and this is the reason the whole file is shaped around
 * groups. If A beat B, B beat C and C beat A on the same score, then
 * "whoever won the meeting goes first" has no answer — and a JavaScript
 * comparator that claims otherwise is not transitive, so Array#sort returns
 * implementation-defined results that change with which pairs it happens to
 * examine. That is precisely the non-determinism this file exists to remove,
 * not a new place to hide it.
 *
 * So each tied player gets one number instead: wins minus losses against the
 * others in the tie. That is a total order, it cannot cycle, and it is what
 * league tables have always meant by "head-to-head record". With exactly two
 * tied players it reduces to whoever won the series.
 */
function h2hWithin(id: string, group: RankCandidate[], h2h: H2HWins): number {
  let net = 0;
  for (const other of group) {
    if (other.id === id) continue;
    net += (h2h[id]?.[other.id] || 0) - (h2h[other.id]?.[id] || 0);
  }
  return net;
}

// Ordered, highest first. Each is measured within whatever group it's handed,
// which is what makes re-application meaningful: head-to-head among four
// players is a different number from head-to-head among the two of them who
// are still level after the first pass.
const CRITERIA: Array<(c: RankCandidate, group: RankCandidate[], h2h: H2HWins) => number> = [
  (c, group, h2h) => h2hWithin(c.id, group, h2h),
  (c) => winRateOf(c),
  (c) => gamesOf(c),
];

/**
 * Split a group level on score into ordered subgroups, each internally
 * inseparable.
 *
 * The criteria are re-applied from the top inside every subgroup a split
 * produces — the UEFA rule, and the one people expect. It matters as soon as
 * a group only partly separates: if four players are level and head-to-head
 * puts two above the other two, the pair left together get their head-to-head
 * recomputed *between themselves*, which can separate them even though it
 * couldn't when the other two were in the calculation. Carrying the original
 * group's numbers forward would silently skip that.
 *
 * Terminates because a split always yields subgroups strictly smaller than
 * the group that produced it.
 */
export function splitTiedGroup(group: RankCandidate[], h2h: H2HWins): RankCandidate[][] {
  if (group.length <= 1) return [group];
  for (const criterion of CRITERIA) {
    const scored = group.map((c) => ({ c, v: criterion(c, group, h2h) }));
    const values = [...new Set(scored.map((s) => s.v))].sort((a, b) => b - a);
    if (values.length > 1) {
      return values.flatMap((v) => splitTiedGroup(scored.filter((s) => s.v === v).map((s) => s.c), h2h));
    }
  }
  return [group]; // nothing left to separate them: a real shared rank
}

/**
 * Everybody in order, with ranks that share and skip.
 *
 * Grouping by score first is what makes head-to-head safe: it is only ever
 * applied inside a set of players the metric already called equal, so it can
 * never reorder somebody past a player who genuinely scored higher.
 */
export function assignRanks(candidates: RankCandidate[], h2h: H2HWins = {}): RankedPlayer[] {
  const byScore = new Map<number, RankCandidate[]>();
  for (const c of candidates) {
    const list = byScore.get(c.score);
    if (list) list.push(c);
    else byScore.set(c.score, [c]);
  }

  const out: RankedPlayer[] = [];
  let place = 1;

  for (const score of [...byScore.keys()].sort((x, y) => y - x)) {
    for (const sub of splitTiedGroup(byScore.get(score)!, h2h)) {
      // Alphabetical inside a shared rank. Name decides the order they are
      // listed in and never the rank itself — if it separated ranks then
      // nobody could ever share one and the 3, 3, 5 convention would be dead
      // code.
      const listed = [...sub].sort((a, b) => a.name.localeCompare(b.name));
      const tied = listed.length > 1;
      for (const c of listed) out.push({ id: c.id, rank: place, tied });
      place += listed.length;
    }
  }
  return out;
}

/** Wins-between-players, built once from a match list. */
export function buildH2H(matches: any[]): H2HWins {
  const h2h: H2HWins = {};
  for (const m of matches) {
    if (!countsAsPlayed(m) || m.winner === "draw") continue;
    const w = m.winner === "p1" ? m.p1 : m.p2;
    const l = m.winner === "p1" ? m.p2 : m.p1;
    if (!h2h[w]) h2h[w] = {};
    h2h[w][l] = (h2h[w][l] || 0) + 1;
  }
  return h2h;
}
