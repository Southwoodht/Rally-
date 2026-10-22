// Tests for predictions reading the score (core/predict.ts).
// Plain TypeScript with an assert; relative imports (see CLAUDE.md §1).
//
// Sam, 2026-10-22: ratings use win/draw/loss only; the score feeds
// predictions — closer scores mean a closer prediction — and a missing or
// broken score is ignored.

import { explainFactors, predictProb, predictionResult } from "./predict";

let failures = 0;
let checks = 0;
function ok(cond: boolean, what: string) {
  checks++;
  if (!cond) { failures++; console.error(`  FAIL ${what}`); }
}

const players = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
const DAY = 864e5;
const series = (score: string | null, n = 4) => Array.from({ length: n }, (_, i) => ({
  id: "m" + i, p1: "a", p2: "b", winner: "p1", score, status: "confirmed", date: i * DAY,
}));

{
  ok(predictionResult({ p1: "a", p2: "b", winner: "p1", score: null }, "a") === 1, "no score: a plain win");
  ok(predictionResult({ p1: "a", p2: "b", winner: "p1", score: "6-0, 6-0" }, "a") === 1, "6-0 6-0: a whole win");
  const close = predictionResult({ p1: "a", p2: "b", winner: "p1", score: "7-6, 7-6" }, "a");
  ok(close > 0.5 && close < 1, "7-6 7-6: still a win, but less than a whole one");
  ok(Math.abs(predictionResult({ p1: "a", p2: "b", winner: "p1", score: "7-6, 7-6" }, "b") - (1 - close)) < 1e-9, "the loser gets the rest");
  ok(predictionResult({ p1: "a", p2: "b", winner: "p2", score: "6-6" }, "b") === 1, "a level score on a win is broken: ignored");
  ok(predictionResult({ p1: "a", p2: "b", winner: "p1", score: "won easily" }, "a") === 1, "an unreadable score: ignored");
  ok(predictionResult({ p1: "a", p2: "b", winner: "p1", score: "6-2, 6-1" }, "a") === predictionResult({ p1: "a", p2: "b", winner: "p1", score: "2-6, 1-6" }, "a"),
    "free text has no direction: the winner's games are the bigger number either way");
}

{
  const elo = { a: 0, b: 0 };
  const thrash = predictProb("a", "b", series("6-0, 6-0"), elo, players);
  const tight = predictProb("a", "b", series("7-6, 7-6"), elo, players);
  const none = predictProb("a", "b", series(null), elo, players);
  const broken = predictProb("a", "b", series("6-6"), elo, players);
  ok(thrash > tight && tight > 0.5, `closer scores, closer prediction (${thrash.toFixed(3)} > ${tight.toFixed(3)} > 0.5)`);
  ok(Math.abs(none - thrash) < 1e-9, "no score predicts like a whole win");
  ok(Math.abs(broken - none) < 1e-9, "a broken score predicts like no score");
}

{
  const ms = [...series("7-6, 7-6", 2), { id: "x", p1: "b", p2: "a", winner: "p1", score: "6-1, 6-1", status: "confirmed", date: 9 * DAY }, { id: "y", p1: "a", p2: "b", winner: "p2", score: "6-6", status: "confirmed", date: 10 * DAY }];
  const f = explainFactors("a", "b", ms, { a: 0, b: 0 }, players);
  ok(f.h2h.aw === 2 && f.h2h.bw === 2, "head-to-head counts results, broken score or not");
  ok(!!f.h2h.games && f.h2h.games.matches === 3 && f.h2h.games.a === 30 && f.h2h.games.b === 36, `games only from the readable scores: A 7+7+7+7+1+1 = 30, B 6+6+6+6+6+6 = 36 (got ${f.h2h.games?.a}-${f.h2h.games?.b})`);
}

if (failures) { console.error(`\nFAILED — ${failures} of ${checks} checks`); process.exit(1); }
console.log(`PASSED — ${checks}/${checks} checks (predict)`);
