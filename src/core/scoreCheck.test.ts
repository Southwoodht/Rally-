// Tests for scoreProblem (core/sets.ts): a score and the winner must agree.
// Plain TypeScript with an assert; relative imports (see CLAUDE.md §1).

import { gameTo11Problem, orientToWinner, parseSets, scoreProblem } from "./sets";

let failures = 0;
let checks = 0;
function ok(cond: boolean, what: string) {
  checks++;
  if (!cond) { failures++; console.error(`  FAIL ${what}`); }
}

ok(scoreProblem("6-6", "p2", false) !== null, "the real case: 6-6 saved as a loss is refused");
ok(scoreProblem("6-6", "draw", false) === null, "6-6 as a draw is fine");
ok(scoreProblem("", "p1", true) === null && scoreProblem(null, "p2", false) === null, "no score is never a problem");
ok(scoreProblem("6-0 George - 6-3 Will", "draw", false) !== null, "the other real case: unreadable text is refused");
ok(scoreProblem("6-4, 6-3", "draw", false) !== null, "a decisive score can't be a draw");
ok(scoreProblem("6-4, 6-3", "p2", true) !== null, "grid, p1-first: p1 won the sets, p2 picked — refused");
ok(scoreProblem("6-4, 6-3", "p1", true) === null, "grid: agrees");
ok(scoreProblem("6-4, 6-3", "p2", false) === null, "free text has no direction: not refused");
ok(scoreProblem("7-6, 0-6, 7-6", "p1", true) === null, "sets decide, not games: 2 sets to 1 with fewer games is a win");
ok(scoreProblem("1-6, 5-3", "p2", true) === null, "Charlie v Zaach 1-6, 5-3: Zaach won the only finished set");
ok(scoreProblem("6-3, 3-1", "p1", true) === null, "a set up and ahead in the second: fine");
// Sets decide, not total games (Sam, 2026-11-15).
ok(scoreProblem("3-6, 6-4", "draw", true) === null, "the real case: 3-6, 6-4 (one set each) can be a draw");
ok(scoreProblem("3-6, 6-4", "p1", true) === null && scoreProblem("3-6, 6-4", "p2", true) === null, "one set each: either winner (an unrecorded tie-break)");
ok(scoreProblem("6-4, 4-6", "p1", true) === null, "a set each and 10-10 in games: a winner is allowed too");
ok(scoreProblem("6-4, 4-6, 3-1", "p1", true) === null, "a third set as written counts to whoever leads it, as before");
ok(scoreProblem("6-1, 4-6, 6-7", "draw", true) !== null, "1 set to 2 is decisive whatever the games: no draw");
ok(scoreProblem("6-1, 4-6, 6-7", "p1", true) !== null, "p2 won two sets to one with fewer games: p1 refused");
ok(scoreProblem("6-4", "draw", true) !== null && scoreProblem("6-4", "p2", true) !== null, "one set: games decide");
ok(scoreProblem("5-3", "p1", true) === null, "one unfinished set: games decide");
ok(scoreProblem("6-3, 1-4", "draw", true, { short: true }) === null, "short match: total games, 7-7 is a draw");
ok(scoreProblem("6-3, 1-4", "p1", true, { short: true }) !== null, "short match: level games, no winner");
ok(scoreProblem("2-6, 3-1", "p2", true, { short: true }) === null, "short match: more games wins");
ok(scoreProblem("11-7, 9-11", "draw", true) === null, "games to 11, one game each: draw allowed");
ok(scoreProblem("11-7, 9-11, 11-2", "p1", true) === null && scoreProblem("11-7, 9-11, 11-2", "draw", true) !== null, "games to 11: games won decide");

const o = (sc: string, w: "p1" | "p2" | "draw", short = false) => { const r = orientToWinner(parseSets(sc)!, w, { short }); return r ? r.map((x) => x.a + "-" + x.b).join(", ") : null; };
ok(o("3-6, 6-4", "draw") === "3-6, 6-4", "a split draw is shown as written (was hidden: 9-10 in games)");
ok(o("3-6, 6-4", "p2") === "3-6, 6-4", "a split with a winner is shown as written");
ok(o("6-1, 4-6, 6-7", "p2") === "6-1, 4-6, 6-7" && o("1-6, 6-4, 7-6", "p2") === "6-1, 4-6, 6-7", "oriented by sets, not games");
ok(o("6-4, 6-4", "draw") === null, "a decisive score on a draw is still unusable");

ok(gameTo11Problem(11, 7) === null, "11-7 is a game");
ok(gameTo11Problem(9, 11) === null, "9-11 is a game");
ok(gameTo11Problem(12, 10) === null, "12-10 is a game");
ok(gameTo11Problem(15, 13) === null, "15-13 is a game");
ok(gameTo11Problem(11, 10) !== null, "11-10 is not finished");
ok(gameTo11Problem(13, 10) !== null, "13-10 cannot happen");
ok(gameTo11Problem(8, 6) !== null, "8-6 is not finished");
ok(gameTo11Problem(10, 10) !== null, "10-10 is not finished");

if (failures) { console.error(`\nFAILED — ${failures} of ${checks} checks`); process.exit(1); }
console.log(`PASSED — ${checks}/${checks} checks (score check)`);
