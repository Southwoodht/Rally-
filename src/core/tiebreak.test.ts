// Tests for the tiebreak chain.
//
// No test framework: this repo's only gates are tsc and next build, and a
// runner is a dependency, a config and a CI story for one pure file. It is
// plain TypeScript with an assert, compiled and run by `npm run test:core`.
// If a real suite ever arrives these move into it unchanged, because there
// is nothing framework-shaped in them.
//
// Imports are relative rather than "@/core/..." on purpose — tsc does not
// rewrite path aliases on emit, so an aliased import here would compile
// fine and then fail to resolve at run time.

import { assignRanks, buildH2H, compareWithinScore, type RankCandidate } from "./tiebreak";

let failures = 0;
let checks = 0;

function eq(actual: unknown, expected: unknown, what: string) {
  checks++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) {
    failures++;
    console.error("  FAIL  " + what + "\n        expected " + e + "\n        got      " + a);
  }
}

const p = (id: string, name: string, score: number, w: number, d: number, l: number): RankCandidate =>
  ({ id, name, score, w, d, l });

const ranksOf = (out: ReturnType<typeof assignRanks>) => out.map((r) => [r.id, r.rank]);

// --------------------------------------------------------------- the basics
{
  const out = assignRanks([p("a", "Ann", 30, 3, 0, 0), p("b", "Bob", 20, 2, 0, 1), p("c", "Cal", 10, 1, 0, 2)]);
  eq(ranksOf(out), [["a", 1], ["b", 2], ["c", 3]], "plain descending score needs no tiebreak");
  eq(out.every((r) => !r.tied), true, "nobody is marked tied when nobody is");
}

// ------------------------------------------------- head-to-head decides two
{
  // Level on score and on record; Bob beat Ann twice, so Bob is above her.
  const cands = [p("a", "Ann", 18, 5, 0, 5), p("b", "Bob", 18, 5, 0, 5)];
  const h2h = buildH2H([
    { p1: "b", p2: "a", winner: "p1", status: "confirmed" },
    { p1: "a", p2: "b", winner: "p2", status: "confirmed" },
  ]);
  eq(ranksOf(assignRanks(cands, h2h)), [["b", 1], ["a", 2]], "the man who won the series goes first");
  // And it must not depend on the order they arrive in.
  eq(ranksOf(assignRanks([...cands].reverse(), h2h)), [["b", 1], ["a", 2]], "same answer from the reversed input");
}

// ------------------------------------------------------ win rate, then games
{
  const h2h = {};
  // Level on score, never played each other. Ann's win rate is higher.
  eq(
    ranksOf(assignRanks([p("a", "Ann", 18, 6, 0, 2), p("b", "Bob", 18, 4, 0, 4)], h2h)),
    [["a", 1], ["b", 2]],
    "win rate breaks it when they have never met",
  );
  // Same rate; more games played is the stronger claim on the same rate.
  eq(
    ranksOf(assignRanks([p("a", "Ann", 18, 3, 0, 3), p("b", "Bob", 18, 9, 0, 9)], h2h)),
    [["b", 1], ["a", 2]],
    "on equal win rates, more games played goes first",
  );
}

// --------------------------------------------- genuinely tied share and skip
{
  const out = assignRanks([
    p("a", "Ann", 30, 5, 0, 1),
    p("b", "Bob", 18, 4, 0, 4),
    p("c", "Cal", 18, 4, 0, 4),
    p("d", "Dee", 10, 1, 0, 6),
  ]);
  eq(ranksOf(out), [["a", 1], ["b", 2], ["c", 2], ["d", 4]], "two in second means nobody came third: 1, 2, 2, 4");
  eq(out.filter((r) => r.tied).map((r) => r.id), ["b", "c"], "both tied players are flagged");
}

{
  const out = assignRanks([
    p("a", "Ann", 30, 5, 0, 1),
    p("b", "Bob", 18, 4, 0, 4),
    p("c", "Cal", 18, 4, 0, 4),
    p("d", "Dee", 18, 4, 0, 4),
    p("e", "Eve", 10, 1, 0, 6),
  ]);
  eq(ranksOf(out), [["a", 1], ["b", 2], ["c", 2], ["d", 2], ["e", 5]], "three in second: next is fifth");
}

// ------------------------------------------- name orders, but never ranks
{
  const out = assignRanks([p("z", "Zoe", 18, 4, 0, 4), p("a", "Ann", 18, 4, 0, 4)]);
  eq(ranksOf(out), [["a", 1], ["z", 1]], "alphabetical decides the listing order");
  eq(out.every((r) => r.rank === 1), true, "...but both still hold rank 1, because name is not a reason to be above somebody");
  eq(out.every((r) => r.tied), true, "and both are flagged tied");
}

// ------------------------------------- a head-to-head cycle must not explode
{
  // A beat B, B beat C, C beat A — all level on score and record. Pairwise
  // head-to-head has no answer here; the mini-league net does (everyone 0),
  // so it falls through and they share the rank rather than the sort
  // producing a different answer depending on comparison order.
  const cands = [p("a", "Ann", 18, 4, 0, 4), p("b", "Bob", 18, 4, 0, 4), p("c", "Cal", 18, 4, 0, 4)];
  const h2h = buildH2H([
    { p1: "a", p2: "b", winner: "p1", status: "confirmed" },
    { p1: "b", p2: "c", winner: "p1", status: "confirmed" },
    { p1: "c", p2: "a", winner: "p1", status: "confirmed" },
  ]);
  const out = assignRanks(cands, h2h);
  eq(out.map((r) => r.rank), [1, 1, 1], "a rock-paper-scissors cycle shares the rank rather than picking arbitrarily");
  eq(
    ranksOf(assignRanks([...cands].reverse(), h2h)),
    ranksOf(out),
    "and gives the same answer whichever order they arrive in",
  );
}

// ------------------------------------ head-to-head is only for the tied set
{
  // Cal beat Ann, but Ann scored higher. Head-to-head must not reach across
  // a real difference in the metric.
  const h2h = buildH2H([{ p1: "c", p2: "a", winner: "p1", status: "confirmed" }]);
  eq(
    ranksOf(assignRanks([p("a", "Ann", 30, 5, 0, 1), p("c", "Cal", 18, 4, 0, 4)], h2h)),
    [["a", 1], ["c", 2]],
    "beating somebody does not lift you past them on a higher score",
  );
}

// ------------------------------------------------------------- edge cases
{
  eq(assignRanks([], {}), [], "no players is not an error");
  eq(ranksOf(assignRanks([p("a", "Ann", 0, 0, 0, 0)], {})), [["a", 1]], "a player with no games still ranks");
  const both = [p("a", "Ann", 18, 0, 0, 0), p("b", "Bob", 18, 0, 0, 0)];
  eq(assignRanks(both, {}).every((r) => r.rank === 1), true, "two players with nothing to separate them share first");
}

// ----------------------------------------------- draws count as half a win
{
  const out = assignRanks([p("a", "Ann", 18, 2, 4, 2), p("b", "Bob", 18, 3, 0, 5)], {});
  eq(ranksOf(out), [["a", 1], ["b", 2]], "4 draws (rate .5) beats 3 wins in 8 (rate .375)");
}

// ------------------------------------------------- pending games are ignored
{
  const h2h = buildH2H([
    { p1: "a", p2: "b", winner: "p1", status: "pending" },
    { p1: "b", p2: "a", winner: "p1", status: "confirmed" },
  ]);
  eq(ranksOf(assignRanks([p("a", "Ann", 18, 4, 0, 4), p("b", "Bob", 18, 4, 0, 4)], h2h)), [["b", 1], ["a", 2]],
    "a result nobody has agreed to does not decide a tie");
}

// -------------------------------------------------- comparator sanity
{
  const group = [p("a", "Ann", 18, 4, 0, 4), p("b", "Bob", 18, 4, 0, 4)];
  eq(compareWithinScore(group[0], group[1], group, {}), 0, "identical players compare equal");
}

console.log((failures ? "FAILED" : "PASSED") + " — " + (checks - failures) + "/" + checks + " checks");
if (failures) process.exit(1);
