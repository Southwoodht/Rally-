// Tests for core/rivals.ts. Plain TypeScript with an assert; relative imports (see CLAUDE.md §1).
import { peopleCounts, peopleLine, pickNemesis, topRivals } from "./rivals";

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

// People, not matches: Sam 2-1 over Charlie is one person ahead; a 1-1 with
// Zaach and a lone draw with Hugh are two people level.
const pc = peopleCounts([
  { p1: "sam", p2: "charlie", winner: "p1", status: "confirmed" },
  { p1: "charlie", p2: "sam", winner: "p1", status: "confirmed" },
  { p1: "sam", p2: "charlie", winner: "p1", status: "confirmed" },
  { p1: "sam", p2: "zaach", winner: "p1", status: "confirmed" },
  { p1: "zaach", p2: "sam", winner: "p1", status: "confirmed" },
  { p1: "hugh", p2: "sam", winner: "draw", status: "confirmed" },
  { p1: "mike", p2: "sam", winner: "p1", status: "confirmed" },
]);
ok(pc.sam.ahead === 1 && pc.sam.level === 2 && pc.sam.behind === 1, "Sam: ahead of 1, level with 2, behind 1");
ok(pc.charlie.ahead === 0 && pc.charlie.behind === 1, "Charlie: behind Sam");
ok(pc.mike.ahead === 1 && pc.mike.behind === 0, "Mike: ahead of Sam");
ok(!pc.nobody, "nobody who never played gets a count");
ok(peopleLine(pc.sam) === "1–1 · 2 level", "ahead–behind, then the level count");
ok(peopleLine(pc.mike) === "1–0", "level left out when nought");

// Somebody met only in legacy years counts, as on the profile (Sam v Chris);
// legacy never adds to a pair with counted matches.
const lg = peopleCounts([
  { p1: "sam", p2: "chris", winner: "p1", status: "legacy" },
  { p1: "sam", p2: "zaach", winner: "p2", status: "confirmed" },
  { p1: "sam", p2: "zaach", winner: "p1", status: "legacy" },
  { p1: "sam", p2: "zaach", winner: "p1", status: "legacy" },
  { p1: "sam", p2: "hugh", winner: "p1", status: "disputed" },
]);
ok(lg.sam.ahead === 1 && lg.sam.behind === 1 && lg.sam.level === 0, "Chris on legacy alone; Zaach on the counted match; a dispute counts for nothing");

if (failures) { console.error(`\nFAILED — ${failures} of ${checks} checks`); process.exit(1); }
console.log(`PASSED — ${checks}/${checks} checks (rivals)`);
