/**
 * Who wins each division — Sam, 2026-10-23: "a prediction like we do for
 * this season, one per division".
 *
 * The season card shares out a rating; a division has something better to
 * go on: points already won and matches still to play. So the rest of the
 * division is played out a few thousand times. Each open match goes to
 * either side by the usual rating expectation (1 / (1 + 10^(gap/400)), the
 * same curve Glicko and Elo use), the points are added up, and the share of
 * runs each entry finishes top is its chance. A tie on points at the top is
 * shared between the tied entries. A finished division needs no dice: the
 * leader is 100%.
 *
 * The ± counts (Glickman's g factor, as Glicko itself predicts a game): a
 * player with a big ± — a handful of matches — is pulled towards 50/50 in
 * each game rather than treated as exactly as good as their number. Without
 * it, somebody with four wins and a high but shaky rating (Connor Truman,
 * 2026-10-24) came out a near-certain winner.
 *
 * Seeded and pure, so the same table gives the same numbers on every
 * render.
 */

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function divisionOdds(opts: {
  /** Entry ids in the division. */
  entries: string[];
  /** Points each entry has now. */
  points: Record<string, number>;
  /** Matches still to play, as pairs of entry ids. */
  open: Array<[string, string]>;
  pointsWin: number;
  /** An entry's rating; unknown entries sit at 1500. */
  rating: (entryId: string) => number;
  /** An entry's ± (Glicko RD). Absent: no uncertainty is assumed. */
  rd?: (entryId: string) => number;
  sims?: number;
  seed?: number;
}): Record<string, number> {
  const { entries, points, open, pointsWin } = opts;
  const out: Record<string, number> = Object.fromEntries(entries.map((e) => [e, 0]));
  if (!entries.length) return out;
  const sims = open.length ? opts.sims ?? 4000 : 1;
  const rand = rng(opts.seed ?? 1);
  const q = Math.LN10 / 400;
  const g = (a: string, b: string) => {
    if (!opts.rd) return 1;
    const v = opts.rd(a) ** 2 + opts.rd(b) ** 2;
    return 1 / Math.sqrt(1 + (3 * q * q * v) / (Math.PI * Math.PI));
  };
  const pA = open.map(([a, b]) => 1 / (1 + Math.pow(10, (-g(a, b) * (opts.rating(a) - opts.rating(b))) / 400)));
  for (let s = 0; s < sims; s++) {
    const tally: Record<string, number> = {};
    for (const e of entries) tally[e] = points[e] || 0;
    open.forEach(([a, b], i) => {
      if (rand() < pA[i]) tally[a] += pointsWin; else tally[b] += pointsWin;
    });
    let best = -Infinity;
    for (const e of entries) best = Math.max(best, tally[e]);
    const top = entries.filter((e) => tally[e] === best);
    for (const e of top) out[e] += 1 / top.length;
  }
  for (const e of entries) out[e] /= sims;
  return out;
}
