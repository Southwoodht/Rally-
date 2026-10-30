// Tests for scoreProblem (core/sets.ts): a score and the winner must agree.
// Plain TypeScript with an assert; relative imports (see CLAUDE.md §1).

import { gameTo11Problem, scoreProblem } from "./sets";

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
ok(scoreProblem("6-4, 4-6", "p1", true) !== null, "a set each and 10-10 in games is level: no winner without the decider");

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
