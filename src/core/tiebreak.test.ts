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

import { assignRanks, buildH2H, splitTiedGroup, type RankCandidate } from "./tiebreak";
import { ratingColumn } from "./rankDisplay";

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

// ------------------------------- a tie that only partly splits, then again
{
  // Four level on score. Head-to-head separates them into two pairs: Ann and
  // Bob each beat both of Cal and Dee, so +2 apiece; Cal and Dee are -2. That
  // leaves two pairs still level, and the criteria have to be re-applied
  // INSIDE each pair — where Ann beat Bob, and Dee beat Cal. Carrying the
  // original group's numbers forward would leave both pairs tied, because
  // across all four Ann and Bob have identical records and so do Cal and Dee.
  const cands = [
    p("a", "Ann", 18, 5, 0, 5), p("b", "Bob", 18, 5, 0, 5),
    p("c", "Cal", 18, 5, 0, 5), p("d", "Dee", 18, 5, 0, 5),
  ];
  const w = (x: string, y: string) => ({ p1: x, p2: y, winner: "p1", status: "confirmed" });
  const h2h = buildH2H([
    w("a", "c"), w("a", "d"), w("b", "c"), w("b", "d"),  // Ann and Bob over Cal and Dee
    w("a", "b"),                                          // and Ann over Bob
    w("d", "c"),                                          // and Dee over Cal
  ]);
  const out = assignRanks(cands, h2h);
  eq(ranksOf(out), [["a", 1], ["b", 2], ["d", 3], ["c", 4]],
    "a group that splits in two has each half re-judged on its own head-to-head");
  eq(out.every((r) => !r.tied), true, "nobody ends up sharing once the subgroups separate");
  eq(splitTiedGroup(cands, h2h).map((g) => g.map((c) => c.id)), [["a"], ["b"], ["d"], ["c"]],
    "splitTiedGroup returns four singletons");
}

{
  // Same shape, but the second pass can't separate the top pair either, so
  // they share and the next rank skips.
  const cands = [
    p("a", "Ann", 18, 5, 0, 5), p("b", "Bob", 18, 5, 0, 5),
    p("c", "Cal", 18, 4, 0, 6), p("d", "Dee", 18, 4, 0, 6),
  ];
  const w = (x: string, y: string) => ({ p1: x, p2: y, winner: "p1", status: "confirmed" });
  const h2h = buildH2H([w("a", "c"), w("b", "d")]);
  const out = assignRanks(cands, h2h);
  eq(ranksOf(out), [["a", 1], ["b", 1], ["c", 3], ["d", 3]],
    "two shared pairs: 1, 1, 3, 3");
}

// ------------------------------------------------- rating column formatting
{
  // The real Seacourt column, 4 September. Worth pinning as a test because
  // the pair that prompted this rule turns out not to collide at all: 18.48
  // and 17.41 print as 18 and 17, one apart, exactly as they should. The
  // rule is still right, it just doesn't fire here.
  eq(ratingColumn([110, 77, 28, 18.48, 17.41, 14]), ["110", "77", "28", "18", "17", "14"],
    "values that round a whole point apart are left as whole numbers");
  // What an actual collision looks like.
  eq(ratingColumn([18.48, 17.61]), ["18.5", "17.6"], "two neighbours that both round to 18 gain a decimal each");
  eq(ratingColumn([110, 77, 18.48, 17.61, 14]), ["110", "77", "18.5", "17.6", "14"],
    "and only that pair — the rest of the column keeps whole numbers");
  eq(ratingColumn([20, 18.4, 18.2, 17.9, 5]), ["20", "18.4", "18.2", "17.9", "5"],
    "a run of three colliding neighbours all gain a decimal");
  eq(ratingColumn([18.4, 5, 18.3]), ["18", "5", "18"],
    "same rounded value far apart in the column is nobody's confusion");
  // Ten winless players all on exactly nought is the real case here. A
  // decimal that prints the same digits on every row is a rendering fault
  // wearing the costume of precision.
  eq(ratingColumn([0, 0, 0]), ["0", "0", "0"], "identical values stay whole — the decimal would separate nothing");
  eq(ratingColumn([18.02, 17.99]), ["18", "18"], "and values inside a tenth of each other are left alone too");
  eq(ratingColumn([]), [], "an empty column is not an error");
  eq(ratingColumn([9]), ["9"], "one value never collides with anything");
}

// ------------------------- the exact skip Sam asked to see: 11=, 11=, 13
{
  // Ten players deep, two of them inseparable at eleventh.
  const many: RankCandidate[] = [];
  for (let i = 0; i < 10; i++) many.push(p("p" + i, "P" + i, 100 - i, 5, 0, i));
  const out = assignRanks([
    ...many,
    p("x", "Xan", 0, 0, 0, 4),
    p("y", "Yves", 0, 0, 0, 4),
    p("z", "Zoe", 0, 0, 0, 3),
  ], {});
  const tail = out.slice(-3).map((r) => [r.id, r.rank, r.tied]);
  eq(tail, [["x", 11, true], ["y", 11, true], ["z", 13, false]],
    "two sharing eleventh means nobody is twelfth: 11=, 11=, 13");
}

console.log((failures ? "FAILED" : "PASSED") + " — " + (checks - failures) + "/" + checks + " checks");
if (failures) process.exit(1);
