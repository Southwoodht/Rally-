import { countsAsPlayed } from "./matchStatus";
import { START_ELO } from "./constants";

/**
 * What you were rated after every match you have ever played.
 *
 * This reads data the app already computes and then throws away. `computeStats`
 * walks the whole history in date order and records `ratingBefore` for both
 * players at every match, because ranking a best win needs to know what the
 * opponent was worth on the day. Add the delta and you have the rating *after*
 * — and doing that for every match in order is somebody's whole career as a
 * line, which has been sitting one addition away the entire time.
 *
 * Pure, like the rest of core: it takes the maps computeStats returned and
 * gives back points. No fetching, no dates formatted, no React.
 */

export interface RatingPoint {
  matchId: string;
  date: number;
  /** Rating after this match. */
  rating: number;
  /** What the match moved it by. Positive is up, whatever the result. */
  delta: number;
  opponentId: string;
  outcome: "W" | "D" | "L";
}

export interface RatingTimeline {
  /** Oldest first. Empty when they have played nothing that counts. */
  points: RatingPoint[];
  /** Where the line starts — before any match. Their carried-in rating, or 0. */
  start: number;
  /** Lowest and highest the line ever reaches, `start` included, so a career
   *  that only ever went down still has a box to be drawn in. */
  low: number;
  high: number;
  /** Their best ever, and when. Null with no matches.
   *
   *  The FIRST time they reached it, not the last: somebody who peaked in 2019
   *  and has hovered there since peaked in 2019. Picking the last occurrence
   *  would quietly move their best day forward every time they drew level with
   *  it. */
  peak: { rating: number; date: number; matchId: string } | null;
}

export function ratingTimeline(
  playerId: string,
  matches: any[],
  ratingBefore: Record<string, Record<string, number>>,
  deltas: Record<string, Record<string, number>>,
  startRating: number = START_ELO,
): RatingTimeline {
  const points: RatingPoint[] = [];

  // Same filter and same order as computeStats, or the line would be drawn
  // over a different set of matches from the number it ends on.
  const mine = matches
    .filter((m) => countsAsPlayed(m) && (m.p1 === playerId || m.p2 === playerId))
    .sort((a, b) => a.date - b.date);

  for (const m of mine) {
    const before = ratingBefore[m.id]?.[playerId];
    const delta = deltas[m.id]?.[playerId];
    // A match computeStats skipped — one where the opponent is not in the
    // roster it was given — has no entry in either map. Skipping it here too
    // keeps the line and the rating telling the same story, which is the whole
    // point of reading its output rather than recomputing.
    if (before === undefined || delta === undefined) continue;
    const isP1 = m.p1 === playerId;
    points.push({
      matchId: m.id,
      date: m.date,
      rating: before + delta,
      delta,
      opponentId: isP1 ? m.p2 : m.p1,
      outcome: m.winner === "draw" ? "D" : (m.winner === "p1") === isP1 ? "W" : "L",
    });
  }

  let low = startRating, high = startRating;
  let peak: RatingTimeline["peak"] = null;
  for (const p of points) {
    if (p.rating < low) low = p.rating;
    if (p.rating > high) high = p.rating;
    // Strictly greater: the first time they got there.
    if (!peak || p.rating > peak.rating) peak = { rating: p.rating, date: p.date, matchId: p.matchId };
  }

  return { points, start: startRating, low, high, peak };
}

/**
 * The line as SVG coordinates in a box, oldest at the left.
 *
 * Spaced evenly by match rather than by date. A club career is not evenly
 * played — three matches in a fortnight then nothing until spring — and on a
 * true time axis those three pile into one vertical smear while the empty
 * months take half the width. Evenly spaced, every match is equally legible,
 * which is what somebody scrubbing a line is actually looking for. The dates
 * are still on the points, so a readout can say when.
 *
 * `pad` keeps the stroke and the dots inside the box rather than clipped at
 * the extremes, which is where the peak always is.
 */
export function timelinePath(
  t: RatingTimeline,
  width: number,
  height: number,
  pad = 6,
): { d: string; area: string; xy: Array<{ x: number; y: number }> } {
  const values = [t.start, ...t.points.map((p) => p.rating)];
  const n = values.length;
  if (n < 2) return { d: "", area: "", xy: [] };

  const span = Math.max(1e-6, t.high - t.low);
  const x = (i: number) => pad + (i * (width - pad * 2)) / (n - 1);
  const y = (v: number) => height - pad - ((v - t.low) / span) * (height - pad * 2);

  const xy = values.map((v, i) => ({ x: x(i), y: y(v) }));
  const d = xy.map((p, i) => (i ? "L" : "M") + p.x.toFixed(2) + " " + p.y.toFixed(2)).join(" ");
  const area = d + ` L${xy[n - 1].x.toFixed(2)} ${height} L${xy[0].x.toFixed(2)} ${height} Z`;
  return { d, area, xy };
}
