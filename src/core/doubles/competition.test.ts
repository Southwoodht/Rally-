/**
 * Competitions: schedule, draw, bracket and table. Plain asserts.
 */
import {
  roundRobin, seedOrder, bracketSize, knockoutBracket, tiesReadyToDraw, champion,
  roundName, leagueTable, type CompetitionPair, type KnockoutFixture,
} from "./competition";

let checks = 0;
const ok = (cond: boolean, what: string) => {
  checks++;
  if (!cond) { console.error("FAILED: " + what); process.exit(1); }
};

const pairs = (n: number): CompetitionPair[] =>
  Array.from({ length: n }, (_, i) => ({ id: "P" + (i + 1), competitionId: "c", p1: "x" + i, p2: "y" + i, seed: i + 1 }));

// ---------------------------------------------------------------------------
// Round robin
// ---------------------------------------------------------------------------
for (const n of [2, 3, 4, 5, 6, 7, 8]) {
  const ids = pairs(n).map((p) => p.id);
  for (const legs of [1, 2]) {
    const ties = roundRobin(ids, legs);
    ok(ties.length === (n * (n - 1) / 2) * legs, `${n} pairs, ${legs} leg(s): every pairing ${legs} time(s) — got ${ties.length}`);
    const seen = new Map<string, number>();
    for (const t of ties) {
      const k = [t.pairA, t.pairB].sort().join("-");
      seen.set(k, (seen.get(k) || 0) + 1);
      ok(t.pairA !== t.pairB, "nobody plays themselves");
    }
    ok(Array.from(seen.values()).every((c) => c === legs), `${n}/${legs}: each pairing exactly ${legs} time(s)`);
    const byRound = new Map<number, string[]>();
    for (const t of ties) byRound.set(t.round, [...(byRound.get(t.round) || []), t.pairA, t.pairB]);
    ok(Array.from(byRound.values()).every((ps) => new Set(ps).size === ps.length), `${n}/${legs}: nobody plays twice in a round`);
  }
}
{
  // Second leg swaps home and away.
  const ties = roundRobin(["A", "B"], 2);
  ok(ties[0].pairA !== ties[1].pairA, "second leg swaps sides");
  ok(roundRobin(["A"], 1).length === 0, "one pair: no fixtures");
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------
ok(seedOrder(8).join() === "1,8,4,5,2,7,3,6", `seed order for 8 — got ${seedOrder(8).join()}`);
ok(bracketSize(5) === 8 && bracketSize(8) === 8 && bracketSize(2) === 2 && bracketSize(3) === 4, "bracket sizes");
{
  const o = seedOrder(16);
  // 1 and 2 in opposite halves: they can only meet in the final.
  ok(o.indexOf(1) < 8 && o.indexOf(2) >= 8, "1 and 2 are in different halves");
}

// ---------------------------------------------------------------------------
// Knockout: byes, advancing, the next draw
// ---------------------------------------------------------------------------
{
  const ps = pairs(5); // bracket of 8: seeds 1, 2, 3 get byes
  let fixtures: KnockoutFixture[] = [];
  let b = knockoutBracket(ps, fixtures);
  ok(b.length === 3, "5 pairs: three rounds");
  const ready1 = tiesReadyToDraw(b).filter((t) => t.round === 1);
  ok(ready1.length === 1, `only 4 v 5 is a real first-round tie — got ${JSON.stringify(ready1)}`);
  // Seeds 2 and 3 both have byes, so their semi exists from the start.
  ok(tiesReadyToDraw(b).length === 2, "and 2 v 3 is drawable at once: both walked through");
  ok([ready1[0].pairA, ready1[0].pairB].sort().join() === "P4,P5", "and it is seeds 4 and 5");
  // Top seed's bye walks them into round 2, but round 2 is not drawable until 4 v 5 is played.
  ok(b[0].filter((t) => t.winner === "P1" || t.winner === "P2" || t.winner === "P3").length === 3, "byes advance the top three seeds");

  fixtures = [{ id: "f1", round: 1, pairA: "P4", pairB: "P5", winner: null }];
  b = knockoutBracket(ps, fixtures);
  ok(tiesReadyToDraw(b).filter((t) => t.round === 2).length === 1, "2 v 3 is ready (both byes); 1 v ? waits");

  fixtures[0].winner = "B"; // P5 wins
  b = knockoutBracket(ps, fixtures);
  const r2 = tiesReadyToDraw(b).filter((t) => t.round === 2);
  ok(r2.length === 2, "with 4 v 5 played, both semis are ready");
  ok(r2.some((t) => [t.pairA, t.pairB].sort().join() === "P1,P5"), "top seed meets the winner of 4 v 5");

  // Play both semis and the final.
  fixtures.push({ id: "s1", round: 2, pairA: "P1", pairB: "P5", winner: "A" });
  fixtures.push({ id: "s2", round: 2, pairA: "P2", pairB: "P3", winner: "B" });
  b = knockoutBracket(ps, fixtures);
  const fin = tiesReadyToDraw(b);
  ok(fin.length === 1 && fin[0].round === 3 && [fin[0].pairA, fin[0].pairB].sort().join() === "P1,P3", "final: 1 v 3");
  ok(champion(b) === null, "no champion before the final");
  fixtures.push({ id: "fin", round: 3, pairA: "P3", pairB: "P1", winner: "A" });
  ok(champion(knockoutBracket(ps, fixtures)) === "P3", "P3 wins it, even as team A on the reversed fixture");
  ok(tiesReadyToDraw(knockoutBracket(ps, fixtures)).length === 0, "nothing left to draw");

  // Correcting a result corrects the bracket.
  const fixed = fixtures.map((f) => f.id === "s2" ? { ...f, winner: "A" } : f);
  ok(knockoutBracket(ps, fixed)[2][0].a !== undefined, "bracket re-derives from the results");

  // A drawn knockout result advances nobody.
  const drawn = knockoutBracket(ps, [{ id: "f1", round: 1, pairA: "P4", pairB: "P5", winner: "draw" }]);
  ok(tiesReadyToDraw(drawn).filter((t) => t.round === 2).length === 1, "a drawn tie stays open");
}
ok(roundName(3, 3) === "Final" && roundName(2, 3) === "Semi-finals" && roundName(1, 3) === "Quarter-finals" && roundName(1, 4) === "Round 1", "round names");

// ---------------------------------------------------------------------------
// League table
// ---------------------------------------------------------------------------
{
  const ps = pairs(4);
  const t = leagueTable(ps, [
    { pairA: "P1", pairB: "P2", winner: "A", sets: [{ a: 6, b: 2 }, { a: 6, b: 2 }] },
    { pairA: "P3", pairB: "P4", winner: "B", sets: [{ a: 4, b: 6 }, { a: 6, b: 7 }] },
    { pairA: "P1", pairB: "P3", winner: "draw", sets: [{ a: 6, b: 4 }, { a: 4, b: 6 }] },
    { pairA: "P2", pairB: "P4", winner: "A", sets: [] },                  // no score: points only
    { pairA: "P4", pairB: "P1", winner: "A", sets: [{ a: 6, b: 0 }], status: "pending" }, // not counted
  ], 3, 1);
  const row = (id: string) => t.find((r) => r.pairId === id)!;
  ok(row("P1").points === 4 && row("P1").played === 2, "P1: a win and a draw, 4 points; the pending result is ignored");
  ok(row("P2").points === 3 && row("P2").gamesFor === 4, "P2: the scoreless win counts its points and no games");
  ok(row("P4").points === 3, "P4: one win");
  ok(t[0].pairId === "P1" && t[0].place === 1, "P1 top on points");
  // P2 and P4 both on 3: P4's set difference (+2) beats P2's (-2).
  ok(t[1].pairId === "P4" && t[2].pairId === "P2", `set difference separates level points — got ${t.map((r) => r.pairId).join()}`);
  ok(row("P3").points === 1 && t[3].pairId === "P3", "P3 last");

  // Totally level pairs share a place.
  const level = leagueTable(pairs(3), [], 3, 1);
  ok(level.every((r) => r.place === 1), "nobody played: everyone shares first");
  const custom = leagueTable(pairs(2), [{ pairA: "P1", pairB: "P2", winner: "A", sets: [] }], 2, 1);
  ok(custom[0].points === 2, "points per win are the competition's own");
}

console.log(`PASSED — ${checks}/${checks} checks (competitions)`);
