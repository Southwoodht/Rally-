// Tests for level precedence: their claim, then their league admin's
// estimate, then nothing.
//
// Same shape as the others: plain TypeScript with an assert, no framework.
// Imports are relative because tsc does not rewrite path aliases on emit.
//
// The rule these pin down is the whole of why an admin may fill a level in at
// all. If any of these go red, an admin can reach something that is meant to
// be the player's alone.

import { levelAt, levelClaimed, levelIsEstimated, levelNow, timelineIsEstimated } from "./levels";

let failures = 0;
let checks = 0;

function eq(actual: unknown, expected: unknown, what: string) {
  checks++;
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) { failures++; console.error(`  FAIL ${what}\n    expected ${b}\n    got      ${a}`); }
}

const at = (y: number, m = 6) => new Date(y, m - 1, 15).getTime();
const per = (cat: string, sub: string, from: string, to: string | null = null) => ({ cat, sub, from, to });

// ------------------------------------------------------------- levelNow
// The dropdown: theirs if they have set one, the admin's if they have not.

eq(levelNow({ level: { cat: "Pro", sub: "Low" } }), { cat: "Pro", sub: "Low" }, "own level");
eq(levelNow({ level: null, levelEstimate: { cat: "Beginner", sub: "Low" } }),
   { cat: "Beginner", sub: "Low" }, "estimate fills a gap");
eq(levelNow({ level: { cat: "Pro", sub: "Low" }, levelEstimate: { cat: "Beginner", sub: "Low" } }),
   { cat: "Pro", sub: "Low" }, "their claim beats an estimate, however wrong the claim");
eq(levelNow({ level: null }), null, "nothing means nothing");
eq(levelNow(null), null, "no player at all");

// levelClaimed is the same question with the estimate deliberately ignored —
// it backs the form where somebody picks their own level, and the prompt that
// asks them to. Pre-filling either from an admin's guess would turn the guess
// into their claim the moment they saved anything.
eq(levelClaimed({ level: null, levelEstimate: { cat: "Pro", sub: "High" } }), null,
   "levelClaimed never reads the estimate");
eq(levelClaimed({ level: { cat: "Amateur", sub: "Low" }, levelEstimate: { cat: "Pro", sub: "High" } }),
   { cat: "Amateur", sub: "Low" }, "levelClaimed returns their own");

// -------------------------------------------------------------- levelAt
// The timeline, which is the thing that actually grades a match.

const own = [per("Beginner", "Low", "2019-01", "2021-12"), per("Amateur", "Medium", "2022-01")];
const est = [per("Advanced", "High", "2015-01")];

eq(levelAt({ levelHistory: own }, at(2020)), { cat: "Beginner", sub: "Low" }, "own timeline, first period");
eq(levelAt({ levelHistory: own }, at(2023)), { cat: "Amateur", sub: "Medium" }, "own timeline, second period");

eq(levelAt({ levelEstimateHistory: est }, at(2020)), { cat: "Advanced", sub: "High" },
   "an estimate grades a match when they have no timeline");
eq(levelAt({ levelHistory: [], levelEstimateHistory: est }, at(2020)), { cat: "Advanced", sub: "High" },
   "an empty timeline is nothing said, not a claim of no level");

eq(levelAt({ levelHistory: own, levelEstimateHistory: est }, at(2020)), { cat: "Beginner", sub: "Low" },
   "their timeline wins over the estimate");

// The one that stops the two being merged. Their timeline starts in 2019; the
// admin's estimate covers 2015. A match in 2016 is NOT graded against the
// estimate, because reading one source for some dates and the other for the
// rest builds a history neither person ever described, and afterwards nobody
// can say which half came from where.
eq(levelAt({ levelHistory: own, levelEstimateHistory: est }, at(2016)), null,
   "no merging: a date their own timeline does not cover is not recorded");

eq(levelAt({}, at(2020)), null, "no timeline and no estimate is still null");
eq(levelAt(null, at(2020)), null, "no player at all");

// ------------------------------------------------------------- labelling
// Whether to say "set by your league admin" on screen. For words only — no
// rating reads these.

eq(levelIsEstimated({ level: null, levelEstimate: { cat: "Pro", sub: "Low" } }), true, "estimated level");
eq(levelIsEstimated({ level: { cat: "Pro", sub: "Low" }, levelEstimate: { cat: "Beginner", sub: "Low" } }), false,
   "an overridden estimate is not what is being shown");
eq(levelIsEstimated({ level: null }), false, "nothing to label");

eq(timelineIsEstimated({ levelEstimateHistory: est }), true, "estimated timeline");
eq(timelineIsEstimated({ levelHistory: own, levelEstimateHistory: est }), false, "their own timeline is theirs");
eq(timelineIsEstimated({ levelHistory: [], levelEstimateHistory: est }), true, "empty own timeline still reads the estimate");
eq(timelineIsEstimated({}), false, "nothing to label");

// -------------------------------------------------------------------------
if (failures) { console.error(`\nFAILED — ${failures} of ${checks} checks`); process.exit(1); }
console.log(`PASSED — ${checks}/${checks} checks`);
