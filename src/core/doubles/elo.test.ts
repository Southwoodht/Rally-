/**
 * Doubles Elo tests.
 *
 * Plain TypeScript with asserts, compiled by tsconfig.test.json and run by
 * node — the same shape as every other test here, and imported relatively
 * because tsc does not rewrite path aliases on emit.
 *
 * The first block is the brief's own worked example, to its stated decimals.
 * If it ever stops producing 10.35 and 13.80 the maths has moved.
 */
import {
  computeDoubles, expectedA, previewDoubles, showDelta,
  DOUBLES_START, K_ESTABLISHED, K_PROVISIONAL,
  type DoublesMatch,
} from "./elo";

let checks = 0;
const ok = (cond: boolean, what: string) => {
  checks++;
  if (!cond) { console.error("FAILED: " + what); process.exit(1); }
};
const near = (a: number, b: number, eps: number, what: string) =>
  ok(Math.abs(a - b) < eps, `${what} — got ${a}, wanted ${b} (±${eps})`);

const m = (o: Partial<DoublesMatch> & Pick<DoublesMatch, "id" | "teamA" | "teamB" | "winner">): DoublesMatch =>
  ({ playedAt: 1, status: "confirmed", ...o }) as DoublesMatch;

// ---------------------------------------------------------------------------
// The brief's worked example
// ---------------------------------------------------------------------------
{
  // A: 1532 and 1561. B: 1508 and 1489. All four established.
  const seed = {
    elo: { a1: 1532, a2: 1561, b1: 1508, b2: 1489 },
    played: { a1: 9, a2: 9, b1: 9, b2: 9 },
  };

  near((1532 + 1561) / 2, 1546.5, 1e-9, "team A average");
  near((1508 + 1489) / 2, 1498.5, 1e-9, "team B average");
  near(expectedA(1546.5, 1498.5), 0.5686, 0.0001, "E_A");

  const s = computeDoubles(
    [m({ id: "x", teamA: ["a1", "a2"], teamB: ["b1", "b2"], winner: "A" })],
    seed,
  );
  const d = (id: string) => s.deltas.find((x) => x.playerId === id)!;

  near(d("a1").delta, 10.35, 0.005, "winner a1 delta");
  near(d("a2").delta, 10.35, 0.005, "winner a2 delta");
  near(d("b1").delta, -10.35, 0.005, "loser b1 delta");
  near(d("b2").delta, -10.35, 0.005, "loser b2 delta");

  ok(d("a1").k === K_ESTABLISHED, "established K is 24");
  near(s.elo.a1, 1532 + 10.35, 0.005, "a1 rating after");
  near(s.elo.b2, 1489 - 10.35, 0.005, "b2 rating after");

  // Both partners share E, but each uses their own K: make a1 provisional and
  // only a1 moves differently.
  const s2 = computeDoubles(
    [m({ id: "x", teamA: ["a1", "a2"], teamB: ["b1", "b2"], winner: "A" })],
    { elo: seed.elo, played: { a1: 0, a2: 9, b1: 9, b2: 9 } },
  );
  const d2 = (id: string) => s2.deltas.find((x) => x.playerId === id)!;
  near(d2("a1").delta, 13.80, 0.005, "provisional a1 delta");
  ok(d2("a1").k === K_PROVISIONAL, "provisional K is 32");
  near(d2("a2").delta, 10.35, 0.005, "a1 being provisional must not change a2");
  near(d2("b1").delta, -10.35, 0.005, "nor either opponent");
}

// ---------------------------------------------------------------------------
// A draw
// ---------------------------------------------------------------------------
{
  const s = computeDoubles(
    [m({ id: "d", teamA: ["a1", "a2"], teamB: ["b1", "b2"], winner: "draw" })],
    { elo: { a1: 1600, a2: 1600, b1: 1400, b2: 1400 }, played: { a1: 9, a2: 9, b1: 9, b2: 9 } },
  );
  const d = (id: string) => s.deltas.find((x) => x.playerId === id)!;

  // The stronger pair drew when they were expected to win, so they lose
  // rating and the weaker pair gains it — equal and opposite.
  ok(d("a1").delta < 0, "favourites lose rating on a draw");
  ok(d("b1").delta > 0, "underdogs gain rating on a draw");
  near(d("a1").delta + d("b1").delta, 0, 1e-9, "a draw is symmetric");
  ok(s.drawn.a1 === 1 && s.drawn.b1 === 1, "a draw counts as drawn for all four");
  ok(s.currentStreak.a1 === 0, "a draw leaves no streak");

  // Two evenly matched pairs drawing move nobody.
  const even = computeDoubles(
    [m({ id: "e", teamA: ["p", "q"], teamB: ["r", "s"], winner: "draw" })],
  );
  near(even.elo.p, DOUBLES_START, 1e-9, "an even draw changes nothing");
}

// ---------------------------------------------------------------------------
// Order, and recompute-after-edit
// ---------------------------------------------------------------------------
{
  const history: DoublesMatch[] = [
    m({ id: "m1", playedAt: 300, teamA: ["a", "b"], teamB: ["c", "d"], winner: "A" }),
    m({ id: "m2", playedAt: 100, teamA: ["a", "c"], teamB: ["b", "d"], winner: "B" }),
    m({ id: "m3", playedAt: 200, teamA: ["a", "d"], teamB: ["b", "c"], winner: "draw" }),
  ];

  // Processed in played_at order regardless of the order handed in — the
  // database does not promise one.
  const inOrder = computeDoubles([history[1], history[2], history[0]]);
  const shuffled = computeDoubles(history);
  ok(JSON.stringify(inOrder.elo) === JSON.stringify(shuffled.elo),
    "the input order must not change the result");

  // "Recompute from scratch after an edit" gives the same answer as having
  // had the edited value all along. Nothing is stored, so this is the whole
  // of the recompute path.
  const edited = history.map((x) => (x.id === "m1" ? { ...x, winner: "B" } : x));
  const afterEdit = computeDoubles(edited);
  const asIfAlways = computeDoubles([
    m({ id: "m2", playedAt: 100, teamA: ["a", "c"], teamB: ["b", "d"], winner: "B" }),
    m({ id: "m3", playedAt: 200, teamA: ["a", "d"], teamB: ["b", "c"], winner: "draw" }),
    m({ id: "m1", playedAt: 300, teamA: ["a", "b"], teamB: ["c", "d"], winner: "B" }),
  ]);
  ok(JSON.stringify(afterEdit.elo) === JSON.stringify(asIfAlways.elo),
    "recompute after an edit equals processing in order");

  // Total rating is conserved while everyone shares a K.
  const total = Object.values(computeDoubles(history).elo).reduce((x, y) => x + y, 0);
  near(total, DOUBLES_START * 4, 1e-6, "rating is conserved among equal-K players");
}

// ---------------------------------------------------------------------------
// Pending matches, streaks, preview and display
// ---------------------------------------------------------------------------
{
  const s = computeDoubles([
    m({ id: "p1", playedAt: 1, teamA: ["a", "b"], teamB: ["c", "d"], winner: "A" }),
    m({ id: "p2", playedAt: 2, teamA: ["a", "b"], teamB: ["c", "d"], winner: "A", status: "pending" }),
  ]);
  ok(s.played.a === 1, "a pending doubles match is not counted");
  ok(s.won.a === 1 && s.currentStreak.a === 1, "streak counts confirmed wins only");

  const streaky = computeDoubles([
    m({ id: "s1", playedAt: 1, teamA: ["a", "b"], teamB: ["c", "d"], winner: "A" }),
    m({ id: "s2", playedAt: 2, teamA: ["a", "b"], teamB: ["c", "d"], winner: "A" }),
    m({ id: "s3", playedAt: 3, teamA: ["a", "b"], teamB: ["c", "d"], winner: "B" }),
  ]);
  ok(streaky.bestStreak.a === 2, "best streak is remembered after it breaks");
  ok(streaky.currentStreak.a === -1, "a loss starts a losing streak");

  // The preview is the same function with one more row, so it cannot drift
  // from what saving produces.
  const history = [m({ id: "h", playedAt: 1, teamA: ["a", "b"], teamB: ["c", "d"], winner: "A" })];
  const preview = previewDoubles(history, { teamA: ["a", "b"], teamB: ["c", "d"], winner: "A", playedAt: 2 });
  const real = computeDoubles([...history, m({ id: "z", playedAt: 2, teamA: ["a", "b"], teamB: ["c", "d"], winner: "A" })]);
  const previewA = preview.find((d) => d.playerId === "a")!;
  const realA = real.deltas.filter((d) => d.playerId === "a").pop()!;
  near(previewA.delta, realA.delta, 1e-9, "preview equals the real thing");

  ok(showDelta(10.3536) === "+10", "deltas display rounded");
  ok(showDelta(-10.3536) === "−10", "and use a real minus sign");
  ok(showDelta(0) === "0", "zero has no sign");
}

console.log(`PASSED — ${checks}/${checks} checks`);
