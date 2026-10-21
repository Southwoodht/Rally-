// Tests for "Count this as a league game?" (core/leagueGame.ts).
// Plain TypeScript with an assert; relative imports (see CLAUDE.md §1).

import { leagueGameOptions, openTiesBetween, settleTie } from "./leagueGame";

let failures = 0;
let checks = 0;
function ok(cond: boolean, what: string) {
  checks++;
  if (!cond) { failures++; console.error(`  FAIL ${what}`); }
}

const comps = [
  { id: "winter", format: "league", status: "running" },
  { id: "cup", format: "knockout", status: "running" },
  { id: "old", format: "league", status: "finished" },
];
const fx = [
  { id: "w3", p1: "sam", p2: "charlie", competitionId: "winter", round: 3 },
  { id: "w1", p1: "charlie", p2: "sam", competitionId: "winter", round: 1 },
  { id: "w2", p1: "sam", p2: "charlie", competitionId: "winter", round: 2, done: true, matchId: "x" },
  { id: "wo", p1: "sam", p2: "charlie", competitionId: "winter", round: 4, outcome: "void" },
  { id: "k1", p1: "sam", p2: "charlie", competitionId: "cup", round: 1 },
  { id: "o1", p1: "sam", p2: "charlie", competitionId: "old", round: 1 },
  { id: "g1", p1: "sam", p2: "george", competitionId: "winter", round: 1 },
  { id: "plain", p1: "sam", p2: "charlie" },
];

{
  const open = openTiesBetween(fx, comps, "sam", "charlie");
  ok(open.map((t) => t.id).join() === "w1,k1,w3", "open ties: either way round, earliest round first, no played/void/finished/plain booking");
  ok(openTiesBetween(fx, comps, "sam", "charlie", true).every((t) => t.competitionId !== "cup"), "a draw can't settle a knockout tie");
  ok(openTiesBetween(fx, comps, "sam", "zaach").length === 0, "nothing owed, nothing asked");
}

{
  const opts = leagueGameOptions(fx, comps, "charlie", "sam");
  ok(opts.length === 2, "one option per competition");
  const w = opts.find((o) => o.tie.competitionId === "winter")!;
  ok(w.tie.id === "w1" && w.left === 2, "winter: the earliest open tie, and 2 left");
}

{
  // The tie says Charlie v Sam; the match was logged Sam v Charlie, Sam won.
  const tie = fx[1];
  const s = settleTie(tie, { id: "m9", p1: "sam", p2: "charlie", winner: "p1" });
  ok(s.done && s.matchId === "m9" && s.winner === "p2", "winner written the tie's way round");
  ok(settleTie(tie, { id: "m10", p1: "sam", p2: "charlie", winner: "draw" }).winner === "draw", "a draw stays a draw");
  ok(settleTie(fx[0], { id: "m11", p1: "sam", p2: "charlie", winner: "p2" }).winner === "p2", "same way round: unchanged");
}

if (failures) { console.error(`\nFAILED — ${failures} of ${checks} checks`); process.exit(1); }
console.log(`PASSED — ${checks}/${checks} checks (league game)`);
