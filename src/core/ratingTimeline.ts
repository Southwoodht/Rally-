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

/**
 * The same career, told as progress rather than as rating.
 *
 * Sam, 2026-09-22: "rather than how good u were that year, how u progressed —
 * but losses it still goes down and wins goes higher."
 *
 * His Elo peaked at 297 in 2019 and sits at 89 now, and he is plainly a
 * better player now than he was then. Both facts are true: Elo is relative,
 * so a pool getting stronger around you pushes your number down while you
 * improve. Honest as "how good were you that year", backwards as "how far
 * have you come".
 *
 * So: one band per level, and your results move you inside it.
 *
 *     progress = levelVal  +  s(rating moved since you entered this level)
 *
 * where s squashes any amount of rating movement into (0, 1). That is the
 * whole trick — **results can never carry you out of your band**. Moving up a
 * level steps you onto the floor of the next one, which is the ceiling of the
 * one you just left, so a promotion always puts you above everything you ever
 * did at the old level. Which is what he asked for.
 *
 * A recorded level DROP lowers the line, deliberately. Making progress ratchet
 * up would hide genuine decline, and this engine reports what is recorded
 * rather than what flatters.
 *
 * Points before their first recorded level are left out entirely: no level, no
 * band, and nothing here guesses one.
 */

/** How much rating movement fills most of a band. Sam's matches move him about
 *  12 a time, so 50 is a few good weeks rather than one lucky night. */
const BAND_SPREAD = 50;

const squash = (x: number): number => 1 / (1 + Math.exp(-x / BAND_SPREAD));

export interface ProgressPoint extends RatingPoint {
  /** 0–18ish. Level band plus where results have moved you inside it. */
  progress: number;
  /** The band itself, for a label. */
  levelVal: number;
}

export function progressTimeline(
  t: RatingTimeline,
  levelValAt: (date: number) => number | null,
): { points: ProgressPoint[]; low: number; high: number } {
  const points: ProgressPoint[] = [];
  let band: number | null = null;
  let ratingAtBandStart = t.start;

  for (const p of t.points) {
    const lv = levelValAt(p.date);
    // Before the first recorded level there is no band to sit in, so the line
    // simply has not started yet.
    if (lv == null) { if (band == null) continue; }
    else if (lv !== band) {
      // A new band — and the rating you carried into it becomes the new zero,
      // so the move within a band is always measured from when you entered it.
      band = lv;
      ratingAtBandStart = p.rating - p.delta;
    }
    if (band == null) continue;
    points.push({ ...p, levelVal: band, progress: band + squash(p.rating - ratingAtBandStart) });
  }

  const values = points.map((p) => p.progress);
  return {
    points,
    low: values.length ? Math.min(...values) : 0,
    high: values.length ? Math.max(...values) : 1,
  };
}
