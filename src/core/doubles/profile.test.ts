/**
 * The doubles profile's lists. Plain asserts, relative imports.
 */
import { computeDoubles, DOUBLES_START, type DoublesMatch } from "./elo";
import { partnersOf } from "./partners";
import { doublesHistory, bestDoublesWins, opponentRecords, overallWinRate } from "./profile";

let checks = 0;
const ok = (cond: boolean, what: string) => {
  checks++;
  if (!cond) { console.error("FAILED: " + what); process.exit(1); }
};

let n = 0;
const m = (teamA: [string, string | null], teamB: [string, string | null], winner: string, status = "confirmed"): DoublesMatch =>
  ({ id: "m" + (++n), playedAt: n * 1000, teamA, teamB, winner, status });

// me plays on both sides of the net, with and against the same people.
const matches: DoublesMatch[] = [
  m(["me", "p"], ["x", "y"], "A"),           // win with p over x&y
  m(["x", "me"], ["p", "y"], "B"),           // loss with x, me on side A
  m(["p", "q"], ["me", "y"], "B"),           // win with y, me on side B
  m(["me", "p"], ["x", null], "draw"),       // draw, unknown opponent
  m(["me", "p"], ["x", "y"], "A", "pending"),// pending: must not appear
  m(["a", "b"], ["c", "d"], "A"),            // not mine
];
const stats = computeDoubles(matches);
const h = doublesHistory(matches, stats, "me");

ok(h.length === 4, `four confirmed matches of mine — got ${h.length}`);
ok(h[0].match.id === "m4" && h[3].match.id === "m1", "newest first");
ok(!h.some((r) => r.match.status === "pending"), "pending results are left out, as every number counts");

const [draw, winB, lossA, winA] = h;
ok(winA.outcome === "w" && winA.partner === "p", "a win on side A, partner p");
ok(lossA.outcome === "l" && lossA.partner === "x", "second seat on A: partner is the first seat");
ok(winB.outcome === "w" && winB.partner === "y", "a win from side B is a win");
ok(draw.outcome === "d", "a draw is a draw");
ok(draw.opponents[1] === null, "the unknown opponent stays null");
ok(winA.onA && !winB.onA, "records which side of the net you were on");

// Rating change is the engine's own delta for me.
const d1 = stats.deltas.find((d) => d.matchId === "m1" && d.playerId === "me")!;
ok(winA.delta === d1.delta, "delta comes straight from the engine");
ok(winA.oppRating === DOUBLES_START, "first match: the opposition were both at the start rating");

// Unknown opponent counts as the start rating in oppRating.
const xBefore = stats.deltas.find((d) => d.matchId === "m4" && d.playerId === "x")!.before;
ok(Math.abs(draw.oppRating - (xBefore + DOUBLES_START) / 2) < 1e-9, "an unknown opponent is DOUBLES_START in the pair average");

// Best wins: the stronger opposition first, losses and draws never.
const best = bestDoublesWins(h);
ok(best.length === 2 && best.every((r) => r.outcome === "w"), "only wins");
ok(best[0].oppRating >= best[1].oppRating, "strongest opposition first");

// Record against: people, not pairs; the unknown is nobody.
const rec = opponentRecords(h);
const x = rec.find((r) => r.opponentId === "x")!;
ok(x.played === 2 && x.won === 1 && x.drawn === 1, `x: faced twice, won one, drew one — got ${JSON.stringify(x)}`);
const p = rec.find((r) => r.opponentId === "p")!;
ok(p.played === 2 && p.won === 1 && p.lost === 1, "p was an opponent twice as well as a partner");
ok(!rec.some((r) => r.opponentId === null), "no row for an unknown opponent");
ok(rec[0].played >= rec[rec.length - 1].played, "most-faced first");

// Overall rate counts the way the Partners card counts, so they compare.
near(overallWinRate(h), (1 + 0 + 1 + 0.5) / 4, "overall: a draw is half");
const withP = partnersOf(matches, "me").find((r) => r.partnerId === "p")!;
near(withP.winRate, (1 + 0.5) / 2, "partner rate uses the same rule");

function near(a: number, b: number, what: string) { ok(Math.abs(a - b) < 1e-9, `${what} — got ${a}, wanted ${b}`); }

console.log(`PASSED — ${checks}/${checks} checks (profile)`);
