// Tests for division odds (core/divisionOdds.ts).
// Plain TypeScript with an assert; relative imports (see CLAUDE.md §1).

import { divisionOdds } from "./divisionOdds";

let failures = 0;
let checks = 0;
function ok(cond: boolean, what: string) {
  checks++;
  if (!cond) { failures++; console.error(`  FAIL ${what}`); }
}
const near = (a: number, b: number, tol = 0.03) => Math.abs(a - b) <= tol;
const flat = () => 1500;

// Finished division: the leader has it, no dice.
const done = divisionOdds({ entries: ["a", "b"], points: { a: 9, b: 6 }, open: [], pointsWin: 3, rating: flat });
ok(done.a === 1 && done.b === 0, "a finished division goes to the leader");

// Level on points, one match left between equals: a coin toss.
const coin = divisionOdds({ entries: ["a", "b"], points: { a: 6, b: 6 }, open: [["a", "b"]], pointsWin: 3, rating: flat });
ok(near(coin.a, 0.5) && near(coin.b, 0.5), "equals level on points: 50/50");

// Rating counts: 400 points stronger wins about 10 in 11.
const strong = divisionOdds({ entries: ["a", "b"], points: { a: 0, b: 0 }, open: [["a", "b"]], pointsWin: 3, rating: (e) => (e === "a" ? 1900 : 1500) });
ok(near(strong.a, 10 / 11), "a 400-point favourite wins about 91%");

// Points in the bag count: 6 clear with one match left can't be caught.
const safe = divisionOdds({ entries: ["a", "b", "c"], points: { a: 9, b: 3, c: 0 }, open: [["b", "c"]], pointsWin: 3, rating: flat });
ok(safe.a === 1, "out of reach is certain");

// Shares add up to one.
const three = divisionOdds({ entries: ["a", "b", "c"], points: { a: 3, b: 3, c: 0 }, open: [["a", "b"], ["b", "c"], ["a", "c"]], pointsWin: 3, rating: flat });
ok(near(three.a + three.b + three.c, 1, 1e-9), "the chances add up to 100%");

// Seeded: the same table gives the same numbers.
ok(JSON.stringify(three) === JSON.stringify(divisionOdds({ entries: ["a", "b", "c"], points: { a: 3, b: 3, c: 0 }, open: [["a", "b"], ["b", "c"], ["a", "c"]], pointsWin: 3, rating: flat })), "same table, same numbers");

if (failures) { console.error(`\nFAILED — ${failures} of ${checks} checks`); process.exit(1); }
console.log(`PASSED — ${checks}/${checks} checks (division odds)`);
