// Tests for the career line.
//
// Same shape as the others: plain TypeScript with an assert, no framework.
// Imports are relative because tsc does not rewrite path aliases on emit.
//
// What matters here is that the line agrees with the rating it ends on. It is
// drawn from computeStats' own output rather than recomputed, so these pin the
// places where it could quietly diverge: a match computeStats skipped, a match
// that does not count, and the order.

import { computeStats } from "./elo";
import { ratingTimeline, timelinePath } from "./ratingTimeline";

let failures = 0;
let checks = 0;

function eq(actual: unknown, expected: unknown, what: string) {
  checks++;
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) { failures++; console.error(`  FAIL ${what}\n    expected ${b}\n    got      ${a}`); }
}
function ok(cond: boolean, what: string) {
  checks++;
  if (!cond) { failures++; console.error(`  FAIL ${what}`); }
}
const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

const P = (id: string, extra: any = {}) => ({ id, name: id, ...extra });
const day = (n: number) => new Date(2026, 0, n).getTime();
const M = (id: string, p1: string, p2: string, winner: string | null, d: number, extra: any = {}) =>
  ({ id, p1, p2, winner, date: day(d), status: "confirmed", score: "", ...extra });

// ------------------------------------------------------------- the basics

{
  const players = [P("a"), P("b")];
  const matches = [M("m1", "a", "b", "p1", 1), M("m2", "a", "b", "p2", 2), M("m3", "a", "b", "p1", 3)];
  const s: any = computeStats(players, matches);
  const t = ratingTimeline("a", matches, s.ratingBefore, s.deltas);

  eq(t.points.length, 3, "one point per match");
  eq(t.points.map((p) => p.outcome), ["W", "L", "W"], "outcomes from a's side");
  eq(t.points.map((p) => p.opponentId), ["b", "b", "b"], "opponent is the other one");
  eq(t.start, 0, "starts at START_ELO with no carried-in rating");

  // THE load-bearing one: the last point must be the rating the rest of the
  // app shows. If these ever drift, the line is telling a different story from
  // the number beside it.
  ok(close(t.points[t.points.length - 1].rating, s.elo.a), "line ends on the live rating");

  // And every point is the one before it plus that match's delta.
  let running = t.start;
  t.points.forEach((p, i) => { running += p.delta; ok(close(running, p.rating), "point " + i + " is a running total"); });
}

// ------------------------------------------------------- order and filters

{
  const players = [P("a"), P("b")];
  // Given out of order on purpose: computeStats sorts, so this must too.
  const matches = [M("late", "a", "b", "p1", 9), M("early", "a", "b", "p2", 2)];
  const s: any = computeStats(players, matches);
  const t = ratingTimeline("a", matches, s.ratingBefore, s.deltas);
  eq(t.points.map((p) => p.matchId), ["early", "late"], "sorted by date, not by input order");
}

{
  const players = [P("a"), P("b")];
  const matches = [
    M("played", "a", "b", "p1", 1),
    M("booked", "a", "b", null, 2, { status: "scheduled" }),
    M("off", "a", "b", "p1", 3, { status: "cancelled" }),
  ];
  const s: any = computeStats(players, matches);
  const t = ratingTimeline("a", matches, s.ratingBefore, s.deltas);
  eq(t.points.map((p) => p.matchId), ["played"], "a booking is not a result and is not a point");
}

{
  // computeStats only counts a match when BOTH players are in the roster it
  // was given — that is load-bearing elsewhere (it is how the personal view
  // scopes results for free). The line has to skip exactly the same matches,
  // or it would draw points the rating never knew about.
  const players = [P("a"), P("b")];
  const matches = [M("in", "a", "b", "p1", 1), M("out", "a", "stranger", "p1", 2)];
  const s: any = computeStats(players, matches);
  const t = ratingTimeline("a", matches, s.ratingBefore, s.deltas);
  eq(t.points.map((p) => p.matchId), ["in"], "a match against somebody outside the roster is skipped");
  ok(close(t.points[0].rating, s.elo.a), "and the line still ends on the live rating");
}

// -------------------------------------------------------------- the peak

{
  const players = [P("a"), P("b"), P("c")];
  const matches = [
    M("w1", "a", "b", "p1", 1),
    M("w2", "a", "c", "p1", 2),
    M("l1", "a", "b", "p2", 3),
  ];
  const s: any = computeStats(players, matches);
  const t = ratingTimeline("a", matches, s.ratingBefore, s.deltas);
  eq(t.peak?.matchId, "w2", "peak is the highest point, not the last");
  ok(t.high >= t.peak!.rating - 1e-9, "high covers the peak");
  ok(t.low <= t.start + 1e-9, "low covers the start");
}

{
  // A career that only ever goes down still needs a box with height, and the
  // start has to be inside it — otherwise the first point is drawn off the top.
  const players = [P("a"), P("b")];
  const matches = [M("l1", "a", "b", "p2", 1), M("l2", "a", "b", "p2", 2)];
  const s: any = computeStats(players, matches);
  const t = ratingTimeline("a", matches, s.ratingBefore, s.deltas);
  ok(t.high >= t.start - 1e-9, "high includes the starting rating on a losing career");
  ok(t.peak!.rating <= t.start, "peak of a losing career is still its best point");
}

// ---------------------------------------------------------- carried-in

{
  const players = [P("a", { initialElo: 250 }), P("b")];
  const matches = [M("m1", "a", "b", "p1", 1)];
  const s: any = computeStats(players, matches);
  const t = ratingTimeline("a", matches, s.ratingBefore, s.deltas, 250);
  eq(t.start, 250, "onboarding's carried-in rating is where the line starts");
  ok(t.points[0].rating > 250, "and a win still moves it up from there");
}

// ------------------------------------------------------------ empty cases

{
  const players = [P("a"), P("b")];
  const s: any = computeStats(players, []);
  const t = ratingTimeline("a", [], s.ratingBefore, s.deltas);
  eq(t.points.length, 0, "nobody with no matches has a line");
  eq(t.peak, null, "and no peak");
  eq(timelinePath(t, 300, 120).d, "", "one value is not a line and draws nothing");
}

// --------------------------------------------------------------- the path

{
  const players = [P("a"), P("b")];
  const matches = [M("m1", "a", "b", "p1", 1), M("m2", "a", "b", "p1", 2)];
  const s: any = computeStats(players, matches);
  const t = ratingTimeline("a", matches, s.ratingBefore, s.deltas);
  const { xy } = timelinePath(t, 300, 120, 6);

  eq(xy.length, 3, "start plus one point per match");
  ok(close(xy[0].x, 6), "first point sits on the left padding");
  ok(close(xy[2].x, 294), "last point sits on the right padding");
  // Evenly spaced by match, not by date — the whole reason a club career is
  // readable at all, since it is played in bursts.
  ok(close(xy[1].x - xy[0].x, xy[2].x - xy[1].x), "points are evenly spaced");
  // Rising career: y falls, because SVG y grows downward.
  ok(xy[2].y < xy[0].y, "a rising rating draws upward");
  ok(xy.every((p) => p.y >= 6 - 1e-9 && p.y <= 114 + 1e-9), "every point is inside the padded box");
}

// -------------------------------------------------------------------------
if (failures) { console.error(`\nFAILED — ${failures} of ${checks} checks`); process.exit(1); }
console.log(`PASSED — ${checks}/${checks} checks`);
