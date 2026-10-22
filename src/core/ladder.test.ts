// Tests for the singles ladder (core/ladder.ts).
// Plain TypeScript with an assert; relative imports (see CLAUDE.md §1).

import { LADDER_REACH, challengeProblem, ladderOrder, type LadderChallenge, type LadderEntry } from "./ladder";

let failures = 0;
let checks = 0;
function ok(cond: boolean, what: string) {
  checks++;
  if (!cond) { failures++; console.error(`  FAIL ${what}`); }
}

const entries: LadderEntry[] = ["zaach", "sam", "charlie", "adrian", "george"].map((p, i) => ({ id: "e" + i, p1: p, seed: i + 1 }));
const ch = (id: string, challenger: string, defender: string, result: LadderChallenge["result"], at: number, open = false): LadderChallenge =>
  ({ id, challenger, defender, result, at, round: at, open });

{
  ok(ladderOrder(entries, []).join() === "zaach,sam,charlie,adrian,george", "no challenges: the starting order");
  const o = ladderOrder(entries, [ch("c1", "adrian", "sam", "challenger", 1)]);
  ok(o.join() === "zaach,adrian,sam,charlie,george", "a win takes the defender's place; those between move down one");
  ok(ladderOrder(entries, [ch("c1", "adrian", "sam", "defender", 1)]).join() === "zaach,sam,charlie,adrian,george", "defender wins: nothing moves");
  ok(ladderOrder(entries, [ch("c1", "adrian", "sam", "draw", 1)]).join() === "zaach,sam,charlie,adrian,george", "a draw: nothing moves");
  ok(ladderOrder(entries, [ch("c1", "adrian", "sam", null, 1, true)]).join() === "zaach,sam,charlie,adrian,george", "an open challenge moves nobody");
}

{
  // Order of decision matters, not order of challenge.
  const later = [ch("c1", "charlie", "sam", "challenger", 5), ch("c2", "george", "charlie", "challenger", 9)];
  ok(ladderOrder(entries, later).join() === "zaach,george,charlie,sam,adrian", "replayed in the order they were decided");
  // A win by someone already above the defender by then moves nobody.
  const stale = [ch("c1", "charlie", "sam", "challenger", 1), ch("c2", "charlie", "sam", "challenger", 2)];
  ok(ladderOrder(entries, stale).join() === "zaach,charlie,sam,adrian,george", "a second win over somebody you already passed changes nothing");
  // Somebody who left is skipped; a late joiner starts at the bottom.
  const without = entries.filter((e) => e.p1 !== "sam").concat({ id: "e9", p1: "will", seed: 6 });
  ok(ladderOrder(without, [ch("c1", "adrian", "sam", "challenger", 1)]).join() === "zaach,charlie,adrian,george,will", "a challenge with a player who left is skipped; the joiner is last");
}

{
  const order = ladderOrder(entries, []);
  ok(challengeProblem(order, [], "george", "sam") === null, `${LADDER_REACH} places up: allowed`);
  ok(!!challengeProblem(order, [], "george", "zaach"), "four places up: too far");
  ok(!!challengeProblem(order, [], "sam", "george"), "down the ladder: no");
  ok(!!challengeProblem(order, [], "sam", "sam"), "yourself: no");
  ok(!!challengeProblem(order, [], "will", "george"), "not on the ladder: join first");
  const busy = [ch("c1", "adrian", "charlie", null, 1, true)];
  ok(!!challengeProblem(order, busy, "adrian", "sam"), "you already have an open challenge");
  ok(!!challengeProblem(order, busy, "george", "charlie"), "they already have one");
  ok(challengeProblem(order, busy, "george", "sam") === null, "anyone else is free");
}

if (failures) { console.error(`\nFAILED — ${failures} of ${checks} checks`); process.exit(1); }
console.log(`PASSED — ${checks}/${checks} checks (ladder)`);
