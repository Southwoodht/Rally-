// Tests for the UTR to level conversion. Plain TypeScript with an assert, no
// framework; relative imports because tsc does not rewrite path aliases.

import { levelForUtr, parseUtr, utrLabel } from "./utr";
import { levelVal } from "./levels";

// starsForLevel (core/stars.ts) imports through an alias the test build cannot
// resolve; it is (levelVal + 1) / 3, so the same sum is done here.
const starsForLevel = (l: { cat: string; sub: string }) => ((levelVal(l) ?? 0) + 1) / 3;

let failures = 0;
let checks = 0;

function eq(actual: unknown, expected: unknown, what: string) {
  checks++;
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) { failures++; console.error(`  FAIL ${what}\n    expected ${b}\n    got      ${a}`); }
}

// The example Sam was shown.
eq(levelForUtr(3.2), { cat: "Amateur", sub: "Low" }, "UTR 3.2 is Amateur / Low");
eq(Math.round((starsForLevel(levelForUtr(3.2)) ?? 0) * 3), 4, "UTR 3.2 is 1⅓ stars");
eq(levelForUtr(4.5), { cat: "Amateur", sub: "High" }, "the top third of a band is High");
eq(levelForUtr(9), { cat: "Semi-pro", sub: "Low" }, "a band starts Low");

// The bands.
eq(levelForUtr(1).cat, "Beginner", "UTR 1 is a beginner");
eq(levelForUtr(4).cat, "Amateur", "UTR 4 is amateur");
eq(levelForUtr(6).cat, "Intermediate", "UTR 6 is intermediate");
eq(levelForUtr(8).cat, "Advanced", "UTR 8 is advanced");
eq(levelForUtr(10.5).cat, "Semi-pro", "UTR 10.5 is semi-pro");
eq(levelForUtr(12).cat, "Pro", "UTR 12 is a pro");
eq(levelForUtr(11.9).cat, "Semi-pro", "UTR 11.9 is not yet");
eq(levelForUtr(16.5), { cat: "Pro", sub: "High" }, "the top of UTR stays six stars");

// Never goes down as UTR goes up.
let last = -1, monotone = true;
for (let u = 1; u <= 16.5; u += 0.05) {
  const s = starsForLevel(levelForUtr(u)) ?? 0;
  if (s < last) monotone = false;
  last = s;
}
eq(monotone, true, "a higher UTR never gives fewer stars");

// Reading what people type.
eq(parseUtr("3.2"), 3.2, "3.2");
eq(parseUtr(" 3,2 "), 3.2, "a comma decimal");
eq(parseUtr(""), null, "nothing typed");
eq(parseUtr("abc"), null, "not a number");
eq(parseUtr("0.5"), null, "below the UTR scale");
eq(parseUtr("17"), null, "above the UTR scale");
eq(utrLabel(3.2), "UTR 3.2", "label, one decimal");
eq(utrLabel(7), "UTR 7.0", "label, whole number");
eq(utrLabel(6.25), "UTR 6.25", "label keeps a second decimal");

if (failures) { console.error(`utr: ${failures} of ${checks} failed`); process.exit(1); }
console.log(`utr: ${checks} checks passed`);
