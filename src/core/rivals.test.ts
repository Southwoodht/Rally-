// Tests for core/rivals.ts. Plain TypeScript with an assert; relative imports (see CLAUDE.md §1).
import { pickNemesis, recordsVs, topRivals, vsLine } from "./rivals";

let failures = 0, checks = 0;
function ok(cond: boolean, what: string) { checks++; if (!cond) { failures++; console.error(`  FAIL ${what}`); } }

// Sam's real case: he leads Charlie Easey 11-3-6 and has lost to him more
// often than to anyone, yet Charlie Easey must never be his nemesis.
const sam = [
  { id: "cheese", w: 11, d: 3, l: 6 },
  { id: "zaach", w: 1, d: 0, l: 4 },
  { id: "hugh", w: 0, d: 0, l: 1 },
  { id: "mike", w: 0, d: 0, l: 2 },
];
ok(pickNemesis(sam)?.id === "zaach", "the nemesis is the best record against you (Zaach, net 3), not the most losses (Cheese)");
ok(pickNemesis([{ id: "hugh", w: 0, d: 0, l: 1 }]) === null, "one match is not enough to be a nemesis");
ok(pickNemesis([{ id: "a", w: 5, d: 0, l: 2 }, { id: "b", w: 2, d: 2, l: 2 }]) === null, "nobody leads you: no nemesis");
ok(pickNemesis([{ id: "a", w: 0, d: 0, l: 2 }, { id: "b", w: 1, d: 0, l: 3 }])?.id === "b", "level on net wins: the longer record");
ok(topRivals(sam).map((r) => r.id).join() === "cheese,zaach,mike", "rivals are the most played");
ok(topRivals([]).length === 0, "nobody played, no rivals");

// Your record against each of them, said the way a table row says it.
const vs = recordsVs([
  { p1: "sam", p2: "charlie", winner: "p1" },
  { p1: "charlie", p2: "sam", winner: "p1" },
  { p1: "sam", p2: "charlie", winner: "p1" },
  { p1: "zaach", p2: "sam", winner: "p1" },
  { p1: "hugh", p2: "sam", winner: "draw" },
  { p1: "mike", p2: "hugh", winner: "p1" },
], "sam");
ok(vsLine(vs.charlie) === "You lead 2–1", "Sam leads Charlie 2–1");
ok(vsLine(vs.zaach) === "You trail 0–1", "Sam trails Zaach");
ok(vsLine(vs.hugh) === "Level 0–1–0", "a draw is level, and shows the draw");
ok(vsLine(vs.mike) === "Never played you", "a match not involving Sam is not his");

if (failures) { console.error(`\nFAILED — ${failures} of ${checks} checks`); process.exit(1); }
console.log(`PASSED — ${checks}/${checks} checks (rivals)`);
