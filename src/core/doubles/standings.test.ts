/**
 * The one doubles ordering, and the weekly movement derived from it.
 * Plain asserts, relative imports — same shape as every test here.
 */
import { computeDoubles, type DoublesMatch } from "./elo";
import { rankedDoubles, doublesPlace, doublesMovement, WEEK_MS } from "./standings";

let checks = 0;
const ok = (cond: boolean, what: string) => {
  checks++;
  if (!cond) { console.error("FAILED: " + what); process.exit(1); }
};

const NOW = 100 * WEEK_MS;
let n = 0;
const m = (teamA: [string, string | null], teamB: [string, string | null], winner: string, playedAt: number): DoublesMatch =>
  ({ id: "m" + (++n), playedAt, teamA, teamB, winner, status: "confirmed" });

const players = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() }));

// ---------------------------------------------------------------------------
// Provisional players are not placed
// ---------------------------------------------------------------------------
{
  const few = computeDoubles([m(["a", "b"], ["c", "d"], "A", 1)]);
  ok(rankedDoubles(few, players).length === 0, "one match each: nobody is placed");
  ok(doublesPlace(few, players, "a") === null, "and a place is null, not a number");
}

// ---------------------------------------------------------------------------
// Ties on the rounded rating fall to wins, then name — the Table's rule
// ---------------------------------------------------------------------------
{
  // Rotate partners so everyone plays five and a/b end level on rating but
  // not on wins: craft stats directly, which is what the function reads.
  const stats = {
    elo: { a: 1510.2, b: 1509.8, c: 1510.4, d: 1400 },
    played: { a: 6, b: 6, c: 6, d: 6 },
    won: { a: 3, b: 4, c: 2, d: 1 },
    lost: {}, drawn: {}, currentStreak: {}, bestStreak: {}, deltas: [],
  };
  const order = rankedDoubles(stats as any, players);
  ok(order.join() === "b,a,c,d", `level on 1510: most wins first, then name — got ${order.join()}`);
  ok(doublesPlace(stats as any, players, "d") === 4, "last is fourth");
}

// ---------------------------------------------------------------------------
// Movement is last week's replay against this week's
// ---------------------------------------------------------------------------
{
  const old = NOW - 2 * WEEK_MS;
  const history: DoublesMatch[] = [];
  // Five weeks-old matches: a & b beat c & d every time, so a and b lead.
  for (let i = 0; i < 5; i++) history.push(m(["a", "b"], ["c", "d"], "A", old + i));
  // This week c & d turn it round: ten straight wins over a & b.
  for (let i = 0; i < 10; i++) history.push(m(["c", "d"], ["a", "b"], "A", NOW - 1000 + i));

  const was = doublesPlace(computeDoubles(history.filter((x) => x.playedAt <= NOW - WEEK_MS)), players, "c");
  const is = doublesPlace(computeDoubles(history), players, "c");
  ok(was !== null && is !== null, "c was placed a week ago and still is");
  const mv = doublesMovement(history, players, "c", NOW);
  ok(mv === (was as number) - (is as number), "movement is last week's place minus this week's");
  ok((mv as number) > 0, `c climbed this week — got ${mv}`);
  ok((doublesMovement(history, players, "b", NOW) as number) < 0, "and b, who lost all ten, dropped");

  // Nothing played this week: everybody held.
  const quiet = history.slice(0, 5);
  ok(doublesMovement(quiet, players, "a", NOW) === 0, "a quiet week is zero, not null");
}

// ---------------------------------------------------------------------------
// Newly placed this week: no arrow, because they did not move FROM anywhere
// ---------------------------------------------------------------------------
{
  const h: DoublesMatch[] = [];
  for (let i = 0; i < 4; i++) h.push(m(["a", "b"], ["c", "d"], "A", NOW - 2 * WEEK_MS + i));
  h.push(m(["a", "b"], ["c", "d"], "A", NOW - 10)); // the fifth, this week
  ok(doublesPlace(computeDoubles(h), players, "a") === 1, "a is placed now");
  ok(doublesMovement(h, players, "a", NOW) === null, "but has no movement: unplaced a week ago");
}

// A future-dated row (a clock skew, a typo) must not leak into "now".
{
  const h: DoublesMatch[] = [];
  for (let i = 0; i < 5; i++) h.push(m(["a", "b"], ["c", "d"], "A", NOW - 2 * WEEK_MS + i));
  const withFuture = [...h, m(["c", "d"], ["a", "b"], "A", NOW + WEEK_MS)];
  ok(doublesMovement(withFuture, players, "a", NOW) === 0, "a match dated after now does not count as this week");
}

console.log(`PASSED — ${checks}/${checks} checks (standings)`);
