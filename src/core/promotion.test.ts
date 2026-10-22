// Tests for promotion and relegation (core/promotion.ts).
// Plain TypeScript with an assert; relative imports (see CLAUDE.md §1).

import { movePlayer, promotionPlan } from "./promotion";

let failures = 0;
let checks = 0;
function ok(cond: boolean, what: string) {
  checks++;
  if (!cond) { failures++; console.error(`  FAIL ${what}`); }
}

const three = [
  { name: "Division 1", standings: ["a1", "a2", "a3", "a4", "a5"] },
  { name: "Division 2", standings: ["b1", "b2", "b3", "b4", "b5"] },
  { name: "Division 3", standings: ["c1", "c2", "c3", "c4", "c5"] },
];

{
  const p = promotionPlan(three, 2);
  ok(p[0].players.join() === "a1,a2,a3,b1,b2", "top tier: its top three stay, the top two of Division 2 come up");
  ok(p[1].players.join() === "a4,a5,b3,c1,c2", "middle: two down from above first, the one who stayed, two up from below");
  ok(p[2].players.join() === "b4,b5,c3,c4,c5", "bottom tier: two down from above, nobody below to go");
  ok(p[0].up.join() === "b1,b2" && p[0].down.length === 0, "the top tier only gains from below");
  ok(p[2].down.join() === "b4,b5" && p[2].up.length === 0, "the bottom tier only gains from above");
  ok(p.reduce((n, d) => n + d.players.length, 0) === 15 && new Set(p.flatMap((d) => d.players)).size === 15, "nobody lost, nobody twice");
}

{
  const p = promotionPlan(three, 1);
  ok(p[0].players.join() === "a1,a2,a3,a4,b1" && p[1].players.join() === "a5,b2,b3,b4,c1", "one up, one down");
}

{
  const small = [{ name: "D1", standings: ["x1", "x2", "x3"] }, { name: "D2", standings: ["y1", "y2", "y3"] }];
  const p = promotionPlan(small, 2);
  ok(p[0].players.join() === "x1,x2,y1" && p[1].players.join() === "x3,y2,y3", "a division of three swaps at most one");
  ok(promotionPlan([{ name: "Only", standings: ["s1", "s2"] }], 2)[0].players.join() === "s1,s2", "one division: nothing moves");
}

{
  const p = movePlayer(promotionPlan(three, 2), "a3", 1);
  ok(!p[0].players.includes("a3") && p[1].players[0] === "a3", "moved down by hand: off the top tier, top of the next");
  const q = movePlayer(p, "c1", -1);
  ok(!q[1].players.includes("c1") && q[0].players[q[0].players.length - 1] === "c1", "moved up by hand: to the foot of the tier above");
  ok(movePlayer(q, "a1", -1) === q, "the top tier cannot go higher");
}

if (failures) { console.error(`\nFAILED — ${failures} of ${checks} checks`); process.exit(1); }
console.log(`PASSED — ${checks}/${checks} checks (promotion)`);
