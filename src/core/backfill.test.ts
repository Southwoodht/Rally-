// Tests for filling a division from matches already played (core/backfill.ts).
// Plain TypeScript with an assert; relative imports (see CLAUDE.md §1).

import { backfillTies, divisionDates, tiesOutsideWindow } from "./backfill";

let failures = 0;
let checks = 0;
function ok(cond: boolean, what: string) {
  checks++;
  if (!cond) { failures++; console.error(`  FAIL ${what}`); }
}

const D = (d: number) => Date.UTC(2026, 0, d);
const m = (id: string, p1: string, p2: string, d: number, extra: any = {}) => ({ id, p1, p2, winner: "p1", date: D(d), status: "confirmed", ...extra });
const matches = [
  m("c1", "sam", "charlie", 5), m("c2", "charlie", "sam", 2), m("c3", "sam", "charlie", 9), // three against Charlie
  m("z1", "sam", "zaach", 4),
  m("x1", "sam", "zaach", 1, { status: "disputed" }),                                         // doesn't count
  m("old", "sam", "zaach", -30),                                                              // before the window
];
const ties = [
  { id: "t2", p1: "charlie", p2: "sam", round: 2 },
  { id: "t1", p1: "sam", p2: "charlie", round: 1 },
  { id: "t3", p1: "sam", p2: "zaach", round: 1 },
  { id: "t4", p1: "zaach", p2: "sam", round: 2 },
  { id: "t5", p1: "sam", p2: "george", round: 1 },
  { id: "t6", p1: "sam", p2: "charlie", round: 3, done: true },
];
const win = { from: D(1), to: D(365) };

const out = backfillTies(ties, matches, win);
const by = Object.fromEntries(out.map((x) => [x.tieId, x.match.id]));
ok(by.t1 === "c2" && by.t2 === "c1", "Charlie: the earliest two, in round order, either way round");
ok(!Object.values(by).includes("c3"), "the third Charlie match is left over");
ok(by.t3 === "z1" && !by.t4, "Zaach: one counting match in the window fills one tie");
ok(!Object.values(by).includes("x1") && !Object.values(by).includes("old"), "a disputed match and one before the window are never used");
ok(!by.t5 && !by.t6, "no match, no fill; an already-played tie is left alone");
ok(!backfillTies(ties, matches, win, new Set(["c2"])).some((x) => x.match.id === "c2"), "a match already settling a tie is not used twice");

// A division's own dates win over the season's, one end at a time.
const season = { startsOn: "2026-01-01", endsOn: "2026-12-31" };
ok(divisionDates({}, season).startsOn === "2026-01-01" && divisionDates({}, season).endsOn === "2026-12-31", "no dates of its own: the season's");
ok(divisionDates({ startsOn: "2026-09-23" }, season).startsOn === "2026-09-23" && divisionDates({ startsOn: "2026-09-23" }, season).endsOn === "2026-12-31", "its own start, the season's end");
ok(divisionDates({}, null).startsOn === null, "no season and no dates: nothing");

// Moving the start later reopens a tie filled from an earlier match, and
// only that one: an organiser's walkover stays.
const settled = [
  { id: "s1", p1: "sam", p2: "charlie", done: true, matchId: "c2" },         // 2 Jan
  { id: "s2", p1: "sam", p2: "zaach", done: true, matchId: "z1" },           // 4 Jan
  { id: "s3", p1: "sam", p2: "george", done: true, outcome: "walkover" },
  { id: "s4", p1: "charlie", p2: "sam", done: true, matchId: "c3" },         // 9 Jan
  { id: "s5", p1: "zaach", p2: "sam", done: false },
];
const out2 = tiesOutsideWindow(settled, matches, { from: D(3), to: D(365) });
ok(out2.length === 1 && out2[0] === "s1", "only the tie settled before the new start reopens");
ok(tiesOutsideWindow(settled, matches, { from: D(1), to: D(5) }).join() === "s4", "and an end moved earlier reopens what falls after it");

if (failures) { console.error(`\nFAILED — ${failures} of ${checks} checks`); process.exit(1); }
console.log(`PASSED — ${checks}/${checks} checks (backfill)`);
