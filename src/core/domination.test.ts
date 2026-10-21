// Tests for the domination headline and the first-meeting phrase.
// Plain TypeScript with an assert; relative imports (see CLAUDE.md §1).

import { dominationHeadline } from "./domination";
import { feedContexts } from "./feedContext";

let failures = 0;
let checks = 0;
function ok(cond: boolean, what: string) {
  checks++;
  if (!cond) { failures++; console.error(`  FAIL ${what}`); }
}
const nm = (id: string) => ({ z: "Zaach", s: "Sam", c: "Charlie", d: "Dan" } as any)[id] || id;
const M = (p1: string, p2: string, winner: string, score: string) => ({ p1, p2, winner, score });

ok(dominationHeadline(M("z", "s", "p1", "6-1, 4-1"), nm) === "Zaach dominates Sam · 10–2", "83%: dominates, the brief's own example");
ok(dominationHeadline(M("z", "s", "p1", "6-0, 6-1"), nm) === "Zaach demolishes Sam · 12–1", "92%: demolishes");
ok(dominationHeadline(M("s", "z", "p2", "1-6, 0-6"), nm) === "Zaach demolishes Sam · 12–1", "written loser-first, read against the winner");
ok(dominationHeadline(M("z", "s", "p1", "6-4, 6-3"), nm) === null, "68%: just a win");
ok(dominationHeadline(M("z", "s", "p1", "3-0"), nm) === null, "under six games is not a demolition");
ok(dominationHeadline(M("z", "s", "draw", "6-1, 1-6"), nm) === null, "a draw dominates nobody");
ok(dominationHeadline(M("z", "s", "p1", ""), nm) === null, "no score, no headline");
ok(dominationHeadline(M("z", "s", "p1", "6-1, 3-0"), nm) === "Zaach demolishes Sam · 9–1", "an unfinished second set counts as written");

// First meeting.
let day = 0;
const F = (p1: string, p2: string, winner: string) => ({ id: "m" + (++day), p1, p2, winner, date: day * 86400000, status: "confirmed" });
const ms = [F("s", "d", "p1"), F("s", "d", "p2"), F("c", "s", "draw"), F("z", "s", "p1")];
const ctx = feedContexts(ms, nm);
ok(ctx.m1 === "First meeting", "the first time two people play: First meeting");
ok(ctx.m2 === "First win vs Sam", "the second time is not a first meeting");
ok(ctx.m3 === "First meeting", "a first meeting can be a draw");
ok(ctx.m4 === "First meeting", "and it is per pair, not per player");

if (failures) { console.error(`\nFAILED — ${failures} of ${checks} checks`); process.exit(1); }
console.log(`PASSED — ${checks}/${checks} checks (domination, first meeting)`);
