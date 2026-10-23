// Tests for the Glicko-2 table mode (core/glicko.ts).
// Plain TypeScript with an assert; relative imports (see CLAUDE.md §1).

import { computeGlicko, glickoStandings, glickoUpdate, GLICKO_PROVISIONAL_RD, GLICKO_RD_LEVEL, GLICKO_RD_NO_LEVEL, GLICKO_START } from "./glicko";

let failures = 0;
let checks = 0;
function ok(cond: boolean, what: string) {
  checks++;
  if (!cond) { failures++; console.error(`  FAIL ${what}`); }
}
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

// ------------------------------------------- Glickman's own worked example
{
  // Glickman (2012), "Example of the Glicko-2 system": 1500 ± 200, vol 0.06,
  // tau 0.5; beats 1400 ± 30, loses to 1550 ± 100 and 1700 ± 300.
  const r = glickoUpdate({ rating: 1500, rd: 200, vol: 0.06 }, [
    { opp: { rating: 1400, rd: 30, vol: 0.06 }, score: 1 },
    { opp: { rating: 1550, rd: 100, vol: 0.06 }, score: 0 },
    { opp: { rating: 1700, rd: 300, vol: 0.06 }, score: 0 },
  ]);
  ok(near(r.rating, 1464.06, 0.05), `paper: rating 1464.06 (got ${r.rating.toFixed(2)})`);
  ok(near(r.rd, 151.52, 0.05), `paper: RD 151.52 (got ${r.rd.toFixed(2)})`);
  ok(near(r.vol, 0.05999, 0.00001), `paper: volatility 0.05999 (got ${r.vol.toFixed(5)})`);
}

const DAY = 864e5, T0 = Date.UTC(2026, 0, 10);
const lvl = (cat: string, sub: string, from = "2020-01") => ({ level: { cat, sub }, levelHistory: [{ cat, sub, from, to: null }] });
const players = [
  { id: "adv", name: "Adv", ...lvl("Advanced", "Low") },     // 9 -> 1650
  { id: "int", name: "Int", ...lvl("Intermediate", "Low") }, // 6 -> 1500
  { id: "none", name: "None" },
  { id: "out", name: "Not in the roster", ...lvl("Pro", "High") },
];
const match = (id: string, p1: string, p2: string, winner: string, day: number, status = "confirmed") =>
  ({ id, p1, p2, winner, score: null, status, date: T0 + day * DAY });

// ------------------------------------------------ levels as the start only
{
  const t = computeGlicko(players, [match("m1", "adv", "none", "draw", 0)], T0);
  ok(near(t.rating.adv, 1650, 60), "Advanced/Low starts at 1650");
  ok(t.rd.adv < GLICKO_RD_LEVEL && t.rd.none < GLICKO_RD_NO_LEVEL, "one match makes both a little surer");
  ok(t.rating.none > GLICKO_START, "no level: starts in the middle, and a draw with somebody stronger lifts you");
  ok(t.provisional.adv && t.provisional.none, "after one match, everybody is provisional");
  ok(!("int" in t.rating), "nobody who has not played has a rating");
}

// ------------------------------------------------ win / draw / loss only
{
  const a = computeGlicko(players, [{ ...match("m1", "int", "none", "p1", 0), score: "6-0, 6-0" }], T0);
  const b = computeGlicko(players, [{ ...match("m1", "int", "none", "p1", 0), score: "7-6, 7-6" }], T0);
  ok(a.rating.int === b.rating.int && a.rd.int === b.rd.int, "the score does not move a rating");
  ok(a.rating.int > GLICKO_START && a.rating.none < GLICKO_START, "the winner goes up, the loser down");
}

// ------------------------------------------------ settles, and ages
{
  const ms = Array.from({ length: 20 }, (_, i) => match("w" + i, "int", "none", i % 4 === 3 ? "p2" : "p1", i * 7));
  const end = T0 + 19 * 7 * DAY;
  const t = computeGlicko(players, ms, end);
  ok(t.rd.int < GLICKO_PROVISIONAL_RD && !t.provisional.int, `twenty weekly matches: no longer provisional (± ${t.rd.int.toFixed(0)})`);
  ok(t.rating.int > t.rating.none, "15-0-5 is above 5-0-15");
  const later = computeGlicko(players, ms, end + 2 * 365 * DAY);
  ok(later.rating.int === t.rating.int, "time off never moves the rating");
  ok(later.rd.int > t.rd.int + 30 && later.provisional.int, `two years off: the ± grows back to provisional (± ${later.rd.int.toFixed(0)})`);
}

// ------------------------------------------------ what counts
{
  const t = computeGlicko(players.filter((p) => p.id !== "out"), [
    match("x1", "int", "out", "p2", 0),               // opponent not in the roster
    match("x2", "int", "adv", "p1", 1, "disputed"),   // counts for nothing
    match("x3", "int", "adv", "p1", 2, "pending"),    // pending counts, as in every rating
  ], T0 + 2 * DAY);
  ok(!("out" in t.rating), "a match against someone outside the roster is not counted");
  ok(t.rating.int > GLICKO_START && t.rating.adv < 1650, "only the pending win counted");
}


// ------------------------------------------------ places, as the Table gives them
{
  // int plays none twenty times (established); adv plays once (short of 5).
  const ms = [
    ...Array.from({ length: 20 }, (_, i) => match("s" + i, "int", "none", i % 4 === 3 ? "p2" : "p1", i * 7)),
    match("a1", "adv", "int", "p1", 140),
  ];
  const now = T0 + 140 * DAY;
  const st = glickoStandings(players, ms, { minGames: 5, now });
  ok(st.status.adv === "short" && st.played.adv === 1, "one match: short of the five");
  ok(st.status.int === "placed" && st.status.none === "placed", "twenty weekly matches each: placed");
  ok(st.place.int === 1 && st.place.none === 2 && st.of === 2, "placed in rating order, short players not counted");
  const onlyNone = glickoStandings(players, ms, { minGames: 5, now, eligible: (id) => id !== "int" });
  ok(onlyNone.place.none === 1 && onlyNone.of === 1 && !("int" in onlyNone.status), "eligible narrows who is listed, and so the places");
  const later = glickoStandings(players, ms, { minGames: 5, now: now + 3 * 365 * DAY });
  ok(later.status.int === "provisional" && later.of === 0, "three years on, the ± has grown past the line: provisional, no place");
}

// The seed: an unplayed Beginner/Medium starts five steps under the middle.
{
  const { glickoSeed } = require("./glicko");
  const seed = glickoSeed({ id: "c", level: { cat: "Beginner", sub: "Medium" } });
  ok(seed.rating === 1250 && seed.rd === 200, "an unplayed Beginner/Medium starts at 1250 ± 200");
  ok(glickoSeed({ id: "x" }).rating === 1500 && glickoSeed({ id: "x" }).rd === 350, "no level: the middle, widest ±");
}

if (failures) { console.error(`\nFAILED — ${failures} of ${checks} checks`); process.exit(1); }
console.log(`PASSED — ${checks}/${checks} checks (glicko)`);
