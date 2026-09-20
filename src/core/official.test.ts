// Tests for Official points, and specifically for weighing a loss by the gap.
//
// Same shape as the others: plain TypeScript with an assert, no framework.
// Imports are relative because tsc does not rewrite path aliases on emit.
//
// The change under test is narrow and the tests are mostly about what it must
// NOT touch: wins, draws, quality and activity all had to come out unmoved,
// because the whole argument for making it was that only the losses were
// wrong.

import { computeOfficial, lossWeight } from "./official";
import { LOSS_WEIGHT_MAX, LOSS_WEIGHT_MIN } from "./constants";

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

// Level values on the 18-point scale: three to a category.
const BEG_LOW = 0, INT_LOW = 6, ADV_LOW = 9;

// ------------------------------------------------------------- lossWeight

eq(lossWeight(INT_LOW, INT_LOW), 1, "a loss to your own level is one loss");
ok(lossWeight(INT_LOW, ADV_LOW) < 1, "losing to somebody above you costs less");
ok(lossWeight(INT_LOW, BEG_LOW) > 1, "losing to somebody below you costs more");
ok(close(lossWeight(INT_LOW, INT_LOW + 3), 0.7), "one category up is 0.7 of a loss");
ok(close(lossWeight(INT_LOW, INT_LOW - 3), 1.3), "one category down is 1.3");

// Symmetry about zero: the forgiveness and the penalty are the same slope, so
// nobody can gain by the gap being measured from one end rather than the other.
for (const gap of [1, 2, 3, 5, 8]) {
  ok(close(lossWeight(6, 6 + gap) - 1, -(lossWeight(6, 6 - gap) - 1)),
    "weight is symmetric about level for a gap of " + gap);
}

eq(lossWeight(INT_LOW, 17), LOSS_WEIGHT_MIN, "clamped below, so a huge gap never erases a defeat");
eq(lossWeight(17, BEG_LOW), LOSS_WEIGHT_MAX, "clamped above");

// The rule that holds everywhere else in this engine: a gap needs two ends.
eq(lossWeight(null, ADV_LOW), 1, "no level of your own means no adjustment");
eq(lossWeight(INT_LOW, null), 1, "no level on theirs means no adjustment");
eq(lossWeight(null, null), 1, "neither recorded means no adjustment");

// ---------------------------------------------------------- computeOfficial

const lv = (v: number | null) => (v == null ? undefined : [{
  cat: ["Beginner", "Amateur", "Intermediate", "Advanced", "Semi-pro", "Pro"][Math.floor(v / 3)],
  sub: ["Low", "Medium", "High"][v % 3],
  from: 2000, to: null,
}]);
const P = (id: string, level: number | null) => ({ id, name: id, levelHistory: lv(level) });
const M = (id: string, p1: string, p2: string, winner: string, day = 1) =>
  ({ id, p1, p2, winner, date: new Date(2026, 0, day).getTime(), status: "confirmed", score: "" });
const rec = (players: any[], matches: any[]) => {
  const w: any = {};
  players.forEach((p) => { w[p.id] = { w: 0, d: 0, l: 0, gp: 0 }; });
  matches.forEach((m) => {
    w[m.p1].gp++; w[m.p2].gp++;
    if (m.winner === "draw") { w[m.p1].d++; w[m.p2].d++; }
    else if (m.winner === "p1") { w[m.p1].w++; w[m.p2].l++; }
    else { w[m.p2].w++; w[m.p1].l++; }
  });
  return w;
};

// The headline: the same record, the same quality of win, and the only
// difference is who the losses were against.
{
  const players = [P("me", INT_LOW), P("strong", ADV_LOW), P("weak", BEG_LOW), P("peer", INT_LOW)];
  const beatPeer = [M("w1", "me", "peer", "p1", 1), M("w2", "me", "peer", "p1", 2)];
  const lostToStrong = [...beatPeer, M("l1", "me", "strong", "p2", 3)];
  const lostToWeak = [...beatPeer, M("l1", "me", "weak", "p2", 3)];

  const a = computeOfficial(players, lostToStrong, rec(players, lostToStrong))["me"];
  const b = computeOfficial(players, lostToWeak, rec(players, lostToWeak))["me"];
  ok(a > b, "losing to a better player costs less than losing to a worse one");
}

// What must NOT have moved.
{
  const players = [P("me", INT_LOW), P("peer", INT_LOW)];
  const all = [M("w1", "me", "peer", "p1", 1), M("w2", "me", "peer", "p1", 2), M("l1", "me", "peer", "p2", 3)];
  const w = rec(players, all);
  const score = computeOfficial(players, all, w)["me"];
  // Every loss is to your own level, so every weight is exactly 1 and the
  // whole formula must land where it always did.
  const list = [1 + INT_LOW / 6.2, 1 + INT_LOW / 6.2];
  const qual = list.reduce((x, y) => x + y, 0) / list.length;
  const wr = (2 + 0 + 1) / (3 + 2);
  const expected = qual * wr * wr * (3 / 13) * 100;
  ok(close(score, expected, 1e-9), "an all-same-level record is unchanged by the new maths");
}

{
  // No levels anywhere is the Seacourt-before-the-repair case, and it must be
  // untouched: every weight is 1 because a gap needs two ends.
  const players = [P("me", null), P("them", null)];
  const all = [M("w1", "me", "them", "p1", 1), M("l1", "me", "them", "p2", 2)];
  const w = rec(players, all);
  const score = computeOfficial(players, all, w)["me"];
  const wr = (1 + 0 + 1) / (2 + 2);
  ok(close(score, 1 * wr * wr * (2 / 12) * 100), "with no levels recorded nothing changes at all");
}

{
  // A draw is not a loss and must not be weighed as one.
  const players = [P("me", INT_LOW), P("strong", ADV_LOW)];
  const all = [M("w1", "me", "strong", "p1", 1), M("d1", "me", "strong", "draw", 2)];
  const w = rec(players, all);
  const score = computeOfficial(players, all, w)["me"];
  const wr = (1 + 0.5 + 1) / (2 + 2);
  ok(close(score, (1 + ADV_LOW / 6.2) * wr * wr * (2 / 12) * 100), "draws are untouched");
}

{
  // Carried-in losses from onboarding have no match and no opponent, so they
  // weigh exactly 1 — the formula must not silently forgive a record nobody
  // can check.
  const players = [P("me", INT_LOW), P("peer", INT_LOW)];
  const all = [M("w1", "me", "peer", "p1", 1)];
  const w: any = rec(players, all);
  w["me"] = { w: 1, d: 0, l: 5, gp: 6 }; // five losses with no matches behind them
  const score = computeOfficial(players, all, w)["me"];
  const wr = (1 + 0 + 1) / (1 + 0 + 5 + 2);
  ok(close(score, (1 + INT_LOW / 6.2) * wr * wr * (6 / 16) * 100), "a carried-in record is not reweighed");
}

{
  // Nobody with no wins gets a score, weighted losses or not — the formula
  // still has no signal below one win, which is recorded in §10 and unruled.
  const players = [P("me", INT_LOW), P("strong", ADV_LOW)];
  const all = [M("l1", "me", "strong", "p2", 1)];
  eq(computeOfficial(players, all, rec(players, all))["me"], 0, "no wins is still zero");
}

{
  // And the sentinel for somebody who has played nothing is untouched, because
  // the table's bar scale reads it.
  const players = [P("me", INT_LOW)];
  eq(computeOfficial(players, [], rec(players, []))["me"], -1e6, "no games keeps the sentinel");
}

// -------------------------------------------------------------------------
if (failures) { console.error(`\nFAILED — ${failures} of ${checks} checks`); process.exit(1); }
console.log(`PASSED — ${checks}/${checks} checks`);
