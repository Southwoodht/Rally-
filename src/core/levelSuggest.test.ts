// Tests for level suggestions. Plain TypeScript with an assert; relative imports.

import { levelForRating, levelSuggestion, SUGGEST_MIN_MATCHES } from "./levelSuggest";

let failures = 0;
let checks = 0;
function eq(actual: unknown, expected: unknown, what: string) {
  checks++;
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) { failures++; console.error(`  FAIL ${what}\n    expected ${b}\n    got      ${a}`); }
}

const sam = { id: "sam", level: { cat: "Intermediate", sub: "High" }, levelHistory: [{ cat: "Intermediate", sub: "High", from: "2025-01", to: null }] };
// Intermediate / High is level 8: seed 1600, band 1575-1625.
const games = (n: number, from = Date.UTC(2026, 0, 10)) =>
  Array.from({ length: n }, (_, i) => ({ id: "m" + i, p1: "sam", p2: "x", winner: "p1", status: "confirmed", date: from + i * 86400000 }));

eq(levelForRating(1500), { cat: "Intermediate", sub: "Low" }, "1500 is Intermediate / Low");
eq(levelForRating(1650), { cat: "Advanced", sub: "Low" }, "1650 is Advanced / Low");
eq(levelForRating(400), { cat: "Beginner", sub: "Low" }, "never below the bottom");
eq(levelForRating(3000), { cat: "Pro", sub: "High" }, "never above the top");

// Clearly above: 1760 ± 90 → low end 1670, over the band's top of 1625.
const up = levelSuggestion(sam, 1760, 90, games(8));
eq(up && up.to, { cat: "Advanced", sub: "High" }, "a clear run suggests the level the rating sits in");
eq(up && up.up, true, "and says it is a move up");

// Leaning, not ruled out: 1700 ± 90 → low end 1610, inside the band.
eq(levelSuggestion(sam, 1700, 90, games(8)), null, "a rating that only leans says nothing");
// Same rating, sure of it.
eq(levelSuggestion(sam, 1700, 40, games(8))?.to, { cat: "Advanced", sub: "Medium" }, "a narrow ± lets the same rating speak");

// Clearly below.
const down = levelSuggestion(sam, 1430, 80, games(8));
eq(down && down.up, false, "a clear slump suggests a move down");

// Not enough matches since the level last changed.
eq(levelSuggestion(sam, 1800, 60, games(SUGGEST_MIN_MATCHES - 1)), null, "too few matches says nothing");
const moved = { ...sam, levelHistory: [{ cat: "Intermediate", sub: "Medium", from: "2025-01", to: "2026-05" }, { cat: "Intermediate", sub: "High", from: "2026-06", to: null }] };
eq(levelSuggestion(moved, 1800, 60, games(8)), null, "matches before the last change do not count");

// No level: nothing to correct.
eq(levelSuggestion({ id: "sam" }, 1800, 60, games(8)), null, "no level, no suggestion");
// A disputed result is not evidence (a pending one is, as everywhere else).
eq(levelSuggestion(sam, 1800, 60, games(8).map((m) => ({ ...m, status: "disputed" }))), null, "disputed results do not count");

if (failures) { console.error(`levelSuggest: ${failures} of ${checks} failed`); process.exit(1); }
console.log(`levelSuggest: ${checks} checks passed`);
