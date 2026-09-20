import { countsAsPlayed } from "./matchStatus";
import {
  LOSS_GAP_FORGIVE, LOSS_WEIGHT_MAX, LOSS_WEIGHT_MIN, WIN_QUALITY_DIVISOR,
} from "./constants";
import { levelAt, levelVal } from "./levels";

// overallScore lived here and was exported and called by nothing — the
// seventh dead declaration found in this file's neighbourhood this month,
// after playingStyle, the profile's period filter, GradedRow.pending,
// myLeaguePlaces, globalRankFor and elo.ts's import of D. Removing it takes
// the last "@/lib/format" import with it, which is what lets this file join
// the test build: tsc does not rewrite path aliases on emit, so an aliased
// import compiles and then fails at run time under node.

/**
 * What one defeat is worth, given who handed it out.
 *
 * `mine` and `theirs` are level values on the 18-point scale, three to a
 * category. Losing to somebody a category above you costs 0.7 of a loss;
 * losing to somebody a category below costs 1.3.
 *
 * **Null on either side means 1 — no adjustment.** A gap needs two ends, and
 * substituting a number for a level nobody recorded is exactly what the
 * 2026-09-06 ruling forbids everywhere else in this engine.
 */
export function lossWeight(mine: number | null, theirs: number | null): number {
  if (mine == null || theirs == null) return 1;
  return Math.max(LOSS_WEIGHT_MIN, Math.min(LOSS_WEIGHT_MAX, 1 - LOSS_GAP_FORGIVE * (theirs - mine)));
}

/**
 * The league's Official points.
 *
 * Your five best wins by opponent quality, times a regularised win rate
 * squared, times an activity term that saturates.
 *
 * **Losses are weighed by the gap as of 2026-09-20**, and that is the only
 * change: wins, draws, the quality term and activity are all untouched. Only
 * the denominator of the win rate moves, because a loss now counts what it
 * was worth rather than one each.
 *
 * Measured on Seacourt 2026 before it was applied. Charlie Henry played Zaach
 * thirteen times and went 3-10; counting every loss the same scored him 29.1
 * against Sam's 51.9, while removing the Zaach fixture entirely would have
 * scored him **39.9**. The table was paying him 10.7 points to avoid the best
 * player in the club, which is the opposite of what a league table is for.
 *
 * Sam's own reading, which is what prompted it: he and Charlie are 5-4 head to
 * head and each would beat the other's opponents, yet Official had him at
 * three times the score.
 */
export function computeOfficial(players, matches, wdl) {
  const byId = {}; players.forEach((p) => { byId[p.id] = p; });
  const qual = {}; const winQuality = {};
  // Losses seen in the match list, and what they weighed. Counted separately
  // from wdl.l because wdl includes onboarding's carried-in record, which has
  // no matches behind it and therefore no opponent to weigh against.
  const lossSeen = {}; const lossWeighed = {};
  players.forEach((p) => { qual[p.id] = 0; winQuality[p.id] = []; lossSeen[p.id] = 0; lossWeighed[p.id] = 0; });

  matches.filter((m) => countsAsPlayed(m) && m.winner !== "draw").forEach((m) => {
    const wid = m.winner === "p1" ? m.p1 : m.p2, lid = m.winner === "p1" ? m.p2 : m.p1;
    const winnerLv = levelVal(levelAt(byId[wid], m.date));
    const loserLv = levelVal(levelAt(byId[lid], m.date));

    // Quality 1 for an opponent with no recorded level: the win counts, the
    // level term doesn't move it either way.
    if (qual[wid] != null) { const q = loserLv == null ? 1 : 1 + loserLv / WIN_QUALITY_DIVISOR; qual[wid] += q; winQuality[wid].push(q); }

    // And the same match from the other side, which is the new half.
    if (lossSeen[lid] != null) { lossSeen[lid] += 1; lossWeighed[lid] += lossWeight(loserLv, winnerLv); }
  });

  const score = {};
  players.forEach((p) => {
    const r = wdl[p.id] || { w: 0, d: 0, l: 0, gp: 0 };
    if (!r.gp) { score[p.id] = -1e6; return; }
    const list = (winQuality[p.id] || []).sort((a, b) => b - a).slice(0, 5); // your five best wins
    if (!list.length) { score[p.id] = 0; return; }
    const qualPerWin = list.reduce((a, b) => a + b, 0) / list.length;
    // Any loss the match list didn't account for — a carried-in record from
    // onboarding — weighs exactly 1, the same as it always did.
    const unaccounted = Math.max(0, r.l - (lossSeen[p.id] || 0));
    const effectiveLosses = (lossWeighed[p.id] || 0) + unaccounted;
    const wrReg = (r.w + 0.5 * r.d + 1) / (r.w + r.d + effectiveLosses + 2); // win rate (counted twice below, so it bites)
    // Activity stays on games actually played. Weighing a loss says something
    // about how hard it was, not about whether it happened.
    const activity = r.gp / (r.gp + 10);
    score[p.id] = qualPerWin * wrReg * wrReg * activity * 100;
  });
  return score;
}
