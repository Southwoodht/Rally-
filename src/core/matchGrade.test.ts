// Tests for the grading function.
//
// Same shape as tiebreak.test.ts: plain TypeScript with an assert, no
// framework. Imports are relative because tsc does not rewrite path aliases
// on emit — an "@/core/..." import here compiles and then fails at run time.

import {
  atOrAbove, categoryGap, gapPhrase, gradeAgainstHistory, gradeMatch, verdictFor,
  type Grade, type Outcome,
} from "./matchGrade";

let failures = 0;
let checks = 0;

function eq(actual: unknown, expected: unknown, what: string) {
  checks++;
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) { failures++; console.error(`  FAIL ${what}\n    expected ${b}\n    got      ${a}`); }
}

const lv = (cat: string, sub = "Medium") => ({ cat, sub });
const BEG = lv("Beginner"), AMA = lv("Amateur"), INT = lv("Intermediate");
const ADV = lv("Advanced"), SEMI = lv("Semi-pro"), PRO = lv("Pro");

// ---------------------------------------------------------------- the table
// Every line of Sam's brief, from the viewer's side, at Intermediate.

const g = (o: Outcome, opp: any, me: any = INT) => gradeMatch(o, me, opp);

eq(g("W", ADV), "statement", "won one above");
eq(g("W", PRO), "statement", "won three above");
eq(g("L", ADV), "noShame", "lost one above");
eq(g("D", ADV), "noShame", "drew one above");
eq(g("L", PRO), "noShame", "lost three above");
eq(g("W", INT), "trueTest", "won at level");
eq(g("L", INT), "trueTest", "lost at level");
eq(g("D", INT), "trueTest", "drew at level");
eq(g("W", AMA), "expected", "won one below");
eq(g("W", BEG), "routine", "won two below");
eq(g("L", AMA), "oneToForget", "lost one below");
eq(g("L", BEG), "oneToForget", "lost two below");

// The line the brief does not cover, decided here and documented in the
// source: a draw against somebody below is a poor day, not an expected one.
eq(g("D", AMA), "oneToForget", "drew one below");
eq(g("D", BEG), "oneToForget", "drew two below");

// ------------------------------------------------------------ sub-levels
// The whole point: sub-level never changes a grade. Intermediate/High
// beating Intermediate/Low is still a true test, not a statement win.

eq(gradeMatch("W", lv("Intermediate", "Low"), lv("Intermediate", "High")), "trueTest", "high sub above is still at level");
eq(gradeMatch("W", lv("Intermediate", "High"), lv("Intermediate", "Low")), "trueTest", "low sub below is still at level");
eq(gradeMatch("W", lv("Intermediate", "High"), lv("Advanced", "Low")), "statement", "next category up counts even from the top sub");
eq(gradeMatch("W", lv("Intermediate", "Low"), lv("Amateur", "High")), "expected", "next category down counts even from the bottom sub");

// ---------------------------------------------------------------- unknowns
eq(g("W", null), null, "no opponent level");
eq(gradeMatch("W", null, ADV), null, "no viewer level");
eq(gradeMatch("W", null, null), null, "neither level");
eq(gradeMatch("W", INT, { cat: "Nonsense", sub: "Medium" }), null, "category not in LEVELS");
eq(gradeMatch("W", INT, { sub: "Medium" }), null, "level object with no category");

// ------------------------------------------------------------------- gaps
eq(categoryGap(INT, ADV), 1, "gap one up");
eq(categoryGap(INT, BEG), -2, "gap two down");
eq(categoryGap(INT, INT), 0, "gap level");
eq(categoryGap(INT, null), null, "gap unknown");
eq(categoryGap(lv("Intermediate", "Low"), lv("Intermediate", "High")), 0, "gap ignores sub-levels");

eq(atOrAbove(INT, ADV), true, "above counts");
eq(atOrAbove(INT, INT), true, "at level counts");
eq(atOrAbove(INT, AMA), false, "below does not");
eq(atOrAbove(INT, null), null, "unknown is not false");

eq(gapPhrase(1), "one above you", "phrase one up");
eq(gapPhrase(2), "two above you", "phrase two up");
eq(gapPhrase(0), "your level", "phrase level");
eq(gapPhrase(-1), "one below you", "phrase one down");
eq(gapPhrase(-3), "three below you", "phrase three down");
eq(gapPhrase(null), null, "phrase unknown");

// --------------------------------------------------------------- ageing
// levelAt reads levelHistory; the "now" side reads the current claim.

const hist = (cat: string, from: any, to: any) => ({ cat, sub: "Medium", from, to });
const AT = new Date("2019-06-15").getTime();

// Opponent was Intermediate in 2019 and is Advanced now. Sam beat them, and
// the win aged well: a true test then, a statement win by today's levels.
const aged = gradeAgainstHistory("W",
  { level: INT, levelHistory: [hist("Intermediate", 2015, null)] },
  { level: ADV, levelHistory: [hist("Intermediate", 2015, "2021-12"), hist("Advanced", "2022-01", null)] },
  AT);
eq(aged.then, "trueTest", "aged: grade on the day");
eq(aged.now, "statement", "aged: grade today");
eq(aged.opponentCategory, "Intermediate", "aged: category on the day");
eq(aged.opponentCategoryNow, "Advanced", "aged: category now");

// Nothing changed, so `now` is null and History shows one chip, not two
// identical ones.
const same = gradeAgainstHistory("W",
  { level: INT, levelHistory: [hist("Intermediate", 2015, null)] },
  { level: ADV, levelHistory: [hist("Advanced", 2015, null)] },
  AT);
eq(same.then, "statement", "unchanged: grade on the day");
eq(same.now, null, "unchanged: no second chip");
eq(same.opponentCategoryNow, null, "unchanged: no second category");

// The opponent's category moved but the grade did not — Beginner to Amateur
// is still a win against somebody below, so still no second chip.
const movedButSame = gradeAgainstHistory("W",
  { level: ADV, levelHistory: [hist("Advanced", 2015, null)] },
  { level: AMA, levelHistory: [hist("Beginner", 2015, "2020-12"), hist("Amateur", "2021-01", null)] },
  AT);
eq(movedButSame.then, "routine", "moved: two below on the day");
eq(movedButSame.now, null, "moved: grade unchanged, so no pair");
eq(movedButSame.opponentCategoryNow, "Amateur", "moved: category still reported");

// No history on the opponent: ungraded on the day even though they have a
// level today. This is the case that covers fourteen of Seacourt's players.
const noHistory = gradeAgainstHistory("W",
  { level: INT, levelHistory: [hist("Intermediate", 2015, null)] },
  { level: ADV },
  AT);
eq(noHistory.then, null, "no history: ungraded on the day");
eq(noHistory.gap, null, "no history: no gap");
eq(noHistory.opponentCategory, null, "no history: no category on the day");
// `now` is still offered, because today's claim is real — but a screen only
// shows the pair when `then` exists, so this cannot render as an ageing.
eq(noHistory.now, "statement", "no history: today's claim still grades");

// A date before the history starts is a hole, not a fallback to the nearest
// period. Nothing may reach back and invent a level for it.
const beforeStart = gradeAgainstHistory("W",
  { level: INT, levelHistory: [hist("Intermediate", 2015, null)] },
  { level: ADV, levelHistory: [hist("Advanced", 2022, null)] },
  AT);
eq(beforeStart.then, null, "before the history starts is ungraded");

// -------------------------------------------------------------- verdicts
eq(verdictFor(1), "Testing schedule", "everything at or above");
eq(verdictFor(0.65), "Testing schedule", "on the testing boundary");
eq(verdictFor(0.64), "Balanced schedule", "just under testing");
eq(verdictFor(0.41), "Balanced schedule", "Sam's 41%");
eq(verdictFor(0.40), "Balanced schedule", "on the balanced boundary");
eq(verdictFor(0.39), "Comfortable schedule", "Sam's complaint: 39% is not balanced");
eq(verdictFor(0.2), "Comfortable schedule", "on the comfortable boundary");
eq(verdictFor(0.19), "Untested", "just under comfortable");
eq(verdictFor(0), "Untested", "nothing at or above");
eq(verdictFor(null), null, "nothing graded has no verdict");
eq(verdictFor(NaN), null, "0/0 has no verdict");

// -------------------------------------------------------------------------
if (failures) { console.error(`\nFAILED — ${failures} of ${checks} checks`); process.exit(1); }
console.log(`PASSED — ${checks}/${checks} checks`);
