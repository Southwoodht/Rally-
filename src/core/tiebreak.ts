// Deciding who is above whom when the ranking metric can't.
//
// Today it doesn't decide at all. rankMaps() sorts on the metric alone, and
// Array#sort is stable, so two players on the same score come out in
// whatever order the players array happened to be in. That is not a tie
// being broken — it's a tie being ignored, and the answer changes the moment
// somebody joins the league or a row comes back from Supabase in a different
// order. Adrian and Charlie Henry are both on 18 Official points and are
// rendered 3rd and 4th for no stated reason.
//
// Nothing here touches the metric. Everything below only ever separates
// players the metric has already declared equal.

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
 * This distinction is the whole reason this function exists. Pairwise
 * head-to-head is not transitive: if A beat B, B beat C and C beat A, all on
 * the same score, then "whoever won the meeting goes first" has no answer
 * and a comparator built on it is not a valid ordering — Array#sort with an
 * inconsistent comparator produces a different result depending on which
 * pairs it happens to examine, which is the bug we are here to remove rather
 * than a new place to hide it.
 *
 * So each tied player gets one number instead: wins minus losses against the
 * others in the tie. That is a total order, it cannot cycle, and it is what
 * league tables have always meant by "head-to-head record". In the common
 * case of exactly two tied players it reduces to precisely what you'd
 * expect — whoever won the series is ahead.
 */
function h2hWithin(id: string, group: RankCandidate[], h2h: H2HWins): number {
  let net = 0;
  for (const other of group) {
    if (other.id === id) continue;
    net += (h2h[id]?.[other.id] || 0) - (h2h[other.id]?.[id] || 0);
  }
  return net;
}

/**
 * The rank-deciding comparison, within a group already level on score.
 *
 * Returns 0 only when two players are genuinely inseparable — equal on
 * head-to-head, win rate and games played. Name is deliberately NOT part of
 * this: alphabetical order is a way to list people, not a reason one of them
 * finished above the other, and folding it in here would mean nobody ever
 * shared a rank and the whole 3, 3, 5 convention could never fire.
 */
export function compareWithinScore(a: RankCandidate, b: RankCandidate, group: RankCandidate[], h2h: H2HWins): number {
  const byH2H = h2hWithin(b.id, group, h2h) - h2hWithin(a.id, group, h2h);
  if (byH2H !== 0) return byH2H;
  const byRate = winRateOf(b) - winRateOf(a);
  if (Math.abs(byRate) > 1e-9) return byRate < 0 ? -1 : 1;
  const byGames = gamesOf(b) - gamesOf(a);
  if (byGames !== 0) return byGames;
  return 0;
}

/** The full ordering, including the alphabetical last resort for display. */
export function compareForDisplay(a: RankCandidate, b: RankCandidate, group: RankCandidate[], h2h: H2HWins): number {
  const decided = compareWithinScore(a, b, group, h2h);
  if (decided !== 0) return decided;
  return a.name.localeCompare(b.name);
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

  const scores = [...byScore.keys()].sort((x, y) => y - x);
  const out: RankedPlayer[] = [];
  let place = 1;

  for (const score of scores) {
    const group = byScore.get(score)!;
    const ordered = [...group].sort((a, b) => compareForDisplay(a, b, group, h2h));

    let i = 0;
    while (i < ordered.length) {
      // Everybody inseparable from ordered[i] shares its place.
      let j = i + 1;
      while (j < ordered.length && compareWithinScore(ordered[i], ordered[j], group, h2h) === 0) j++;
      const shared = j - i > 1;
      for (let k = i; k < j; k++) out.push({ id: ordered[k].id, rank: place, tied: shared });
      // The next place skips the ones just used: two in third means nobody
      // came fourth.
      place += j - i;
      i = j;
    }
  }
  return out;
}

/** Wins-between-players, built once from a match list. */
export function buildH2H(matches: any[]): H2HWins {
  const h2h: H2HWins = {};
  for (const m of matches) {
    if (m.status === "pending" || m.winner === "draw") continue;
    const w = m.winner === "p1" ? m.p1 : m.p2;
    const l = m.winner === "p1" ? m.p2 : m.p1;
    if (!h2h[w]) h2h[w] = {};
    h2h[w][l] = (h2h[w][l] || 0) + 1;
  }
  return h2h;
}
