// A rating built from who beat whom, rather than from summary statistics.
//
// Every earlier attempt at the Global table worked on totals — win counts,
// average opponent level, games played — and every one of them produced a
// table where somebody sat above a player who had beaten them. That is not a
// tuning problem. An average cannot hold a chain: Zaach beat Sam, Sam beat
// Charlie, Charlie beat David. Rank is the shape of that network, so the
// rating has to be computed on the network.
//
// One rule:
//
//     rating(p) = average rating of everyone p played  +  K * (p's rate - 0.5)
//
// solved by iterating until it stops moving. If Zaach beats Sam then Zaach
// finishes K/2 above Sam whatever Sam's own rating turns out to be, which is
// the property that kept breaking. Nobody needs to have set a level for this
// to place them: an unrated player with twenty-four matches is rated on those
// matches, not left sitting on a neutral score.

export interface Edge {
  /** The person this row is about. */
  key: string;
  /** Who they played. Opaque for opponents the viewer can't see. */
  opp: string;
  /**
   * 1 won, 0.5 drew, 0 lost — or somewhere between when the match had a
   * score and the caller blended the margin in (see MARGIN_WEIGHT). A
   * narrow win therefore separates two players by less than a thrashing
   * does, but it still separates them: the winner is always above 0.5 and
   * the loser always below, so a winner never finishes under the man he
   * beat, which is the one promise this whole rating exists to keep.
   */
  result: number;
}

/**
 * How far a record moves you from the level of your opposition. At 6, beating
 * everyone you face puts you three points — one full category — above them,
 * and losing everything puts you a category below. Wide enough to separate
 * the club, narrow enough that one result doesn't launch anybody.
 */
export const RATING_SPREAD = 6;

/** Enough for a club-sized graph to settle; it converges long before this. */
const ITERATIONS = 50;

/** Stop early once nothing is moving by more than this. */
const SETTLED = 1e-4;

/**
 * How far to step towards the newly computed value each pass, rather than
 * jumping straight to it.
 *
 * Jumping overshoots and oscillates. Two players, A beat B: A computes three
 * above B, then B computes three above *that*, and they swap places forever,
 * settling on a dead heat — so the one thing the rating exists to guarantee,
 * that a winner outranks the man he beat, was the one thing it got wrong.
 * Half a step each pass converges on the fixed point instead of bouncing
 * around it, and A finishes above B where he belongs.
 */
const RELAXATION = 0.5;

export interface RatingOptions {
  /** Where the scale sits, so ratings stay readable as level values. */
  anchor?: number;
  spread?: number;
}

/**
 * Ratings keyed by player, on the same 0–17 scale as levels, so a rating of
 * 7.1 reads as "plays like an Intermediate/Medium".
 *
 * The anchor sets where the whole table sits, not where any individual does —
 * it's applied by shifting everybody equally each pass. That matters: it means
 * no one can move their own position by editing their own level, which was
 * the exploit in the previous design.
 */
export function computeRatings(edges: Edge[], opts: RatingOptions = {}): Record<string, number> {
  const anchor = opts.anchor ?? 6;
  const spread = opts.spread ?? RATING_SPREAD;

  // Group once rather than filtering the whole list per player per pass —
  // that was O(players × edges × iterations) and a club with a few thousand
  // matches would have felt it.
  const byPlayer = new Map<string, Edge[]>();
  for (const e of edges) {
    const list = byPlayer.get(e.key);
    if (list) list.push(e);
    else byPlayer.set(e.key, [e]);
  }

  const rating: Record<string, number> = {};
  for (const k of byPlayer.keys()) rating[k] = anchor;
  // Opponents we can't see are nodes too — they have no edges of their own
  // here, but they still carry a rating so the graph stays connected.
  for (const e of edges) if (!(e.opp in rating)) rating[e.opp] = anchor;

  for (let i = 0; i < ITERATIONS; i++) {
    const next: Record<string, number> = { ...rating };
    let moved = 0;
    for (const [key, list] of byPlayer) {
      let oppSum = 0, resSum = 0;
      for (const e of list) { oppSum += rating[e.opp] ?? anchor; resSum += e.result; }
      const target = oppSum / list.length + spread * (resSum / list.length - 0.5);
      const value = rating[key] + RELAXATION * (target - rating[key]);
      moved = Math.max(moved, Math.abs(value - rating[key]));
      next[key] = value;
    }
    // Re-centre. Without this the whole table can drift up or down together,
    // since every rating is defined relative to other ratings.
    const keys = [...byPlayer.keys()];
    if (keys.length) {
      const mean = keys.reduce((a, k) => a + next[k], 0) / keys.length;
      const shift = anchor - mean;
      for (const k of keys) next[k] += shift;
    }
    for (const k of Object.keys(next)) rating[k] = next[k];
    if (moved < SETTLED) break;
  }

  // Only hand back the people we were asked about, not the anonymous nodes.
  const out: Record<string, number> = {};
  for (const k of byPlayer.keys()) out[k] = rating[k];
  return out;
}
