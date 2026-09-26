/**
 * Turning stored fixtures and results into competition ties and table rows.
 * The singles side is where a bug would hide: a free-text score read the
 * wrong way round would hand one player the other's games.
 */
import { singlesCompetitionView, doublesCompetitionView } from "./competitionAdapters";
import { leagueTable, knockoutBracket, type CompetitionPair } from "./competition";

let checks = 0;
const ok = (cond: boolean, what: string) => {
  checks++;
  if (!cond) { console.error("FAILED: " + what); process.exit(1); }
};

const entries: CompetitionPair[] = [
  { id: "eS", competitionId: "c", p1: "sam", p2: null, seed: 1 },
  { id: "eZ", competitionId: "c", p1: "zaach", p2: null, seed: 2 },
  { id: "eC", competitionId: "c", p1: "charlie", p2: null, seed: 3 },
];

// ---------------------------------------------------------------- singles
{
  const fixtures = [
    { id: "f1", p1: "sam", p2: "zaach", done: true, matchId: "m1", competitionId: "c", round: 1 },
    // Stored the other way round on the MATCH: Zaach is match p1 here.
    { id: "f2", p1: "sam", p2: "charlie", done: true, matchId: "m2", competitionId: "c", round: 2 },
    { id: "f3", p1: "zaach", p2: "charlie", done: false, competitionId: "c", round: 3 },
    { id: "fx", p1: "sam", p2: "zaach", done: false },                          // casual: not this comp
    { id: "f4", p1: "zaach", p2: "charlie", done: true, matchId: "m4", competitionId: "c", round: 3 },
  ];
  const matches = [
    { id: "m1", p1: "sam", p2: "zaach", winner: "p2", score: "4-6, 3-6", status: "confirmed" },
    { id: "m2", p1: "charlie", p2: "sam", winner: "p1", score: "6-1, 6-2", status: "confirmed" },
    { id: "m4", p1: "zaach", p2: "charlie", winner: "p1", score: "", status: "pending" },
  ];
  const v = singlesCompetitionView("c", entries, fixtures, matches);

  ok(v.ties.length === 4, "only this competition's fixtures");
  ok(v.ties.find((t) => t.id === "f1")!.winner === "B", "Zaach (fixture p2) beat Sam: B");
  ok(v.ties.find((t) => t.id === "f2")!.winner === "B", "Charlie won as MATCH p1 but is FIXTURE p2: still B");
  ok(v.ties.find((t) => t.id === "f3")!.winner === null, "unplayed: no winner");
  ok(v.ties.find((t) => t.id === "f4")!.winner === "A", "a pending result counts, as it does on the singles table");

  const f1 = v.results.find((r) => r.pairA === "eS" && r.pairB === "eZ")!;
  ok(f1.sets.length === 2 && f1.sets[0].a === 4 && f1.sets[0].b === 6, "sets read from Sam's side on f1");
  const f2 = v.results.find((r) => r.pairB === "eC" && r.pairA === "eS")!;
  ok(f2.sets[0].a === 1 && f2.sets[0].b === 6, `sets flipped to the fixture's p1 when the match is stored the other way — got ${JSON.stringify(f2.sets)}`);
  const f4 = v.results.find((r) => r.pairA === "eZ")!;
  ok(f4.sets.length === 0, "no score: points and no sets");

  const t = leagueTable(entries, v.results, 3, 1);
  const row = (id: string) => t.find((r) => r.pairId === id)!;
  ok(row("eZ").points === 6 && row("eC").points === 3 && row("eS").points === 0, "table: Zaach 6, Charlie 3, Sam 0");
  ok(row("eS").gamesFor === 4 + 3 + 3 && row("eS").gamesAgainst === 12 + 12, `Sam's games are Sam's — got ${row("eS").gamesFor}-${row("eS").gamesAgainst}`);
  ok(v.counts.unplayed === 1 && v.counts.played === 3, "counts");
  ok(v.unplayed.length === 1 && v.unplayed[0].id === "f3", "the unplayed list");

  // A result that cannot be reconciled (a 6-4, 6-4 recorded as a draw) counts
  // its points but no sets rather than a guess.
  const odd = singlesCompetitionView("c", entries,
    [{ id: "g", p1: "sam", p2: "zaach", done: true, matchId: "mm", competitionId: "c", round: 1 }],
    [{ id: "mm", p1: "sam", p2: "zaach", winner: "draw", score: "6-4, 6-4", status: "confirmed" }]);
  ok(odd.results[0].winner === "draw" && odd.results[0].sets.length === 0, "irreconcilable score: no sets");

  // Knockout through the adapter: the bracket advances on the singles result.
  const ko: CompetitionPair[] = [
    { id: "k1", competitionId: "k", p1: "a", p2: null, seed: 1 },
    { id: "k2", competitionId: "k", p1: "b", p2: null, seed: 2 },
  ];
  const kv = singlesCompetitionView("k", ko,
    [{ id: "kf", p1: "a", p2: "b", done: true, matchId: "km", competitionId: "k", round: 1 }],
    [{ id: "km", p1: "b", p2: "a", winner: "p1", score: "6-0", status: "confirmed" }]);
  ok(knockoutBracket(ko, kv.ties)[0][0].winner === "k2", "b wins the final as match p1 / fixture p2");
}

// ---------------------------------------------------------------- doubles
{
  const v = doublesCompetitionView("c",
    [
      { id: "d1", done: true, matchId: "x1", competitionId: "c", round: 1, pairA: "P1", pairB: "P2" },
      { id: "d2", done: false, matchId: null, competitionId: "c", round: 1, pairA: "P3", pairB: "P4" },
      { id: "d3", done: true, matchId: "x3", competitionId: "c", round: 2, pairA: "P1", pairB: "P3" },
    ],
    [
      { id: "x1", winner: "A", status: "confirmed", sets: [{ a: 6, b: 2 }], competitionId: "c", teamAPairId: "P1", teamBPairId: "P2" },
      { id: "x3", winner: "B", status: "pending", sets: [], competitionId: "c", teamAPairId: "P1", teamBPairId: "P3" },
    ]);
  ok(v.ties[0].winner === "A", "confirmed doubles result advances");
  ok(v.ties[2].winner === null, "a pending doubles result does not — doubles counts confirmed only");
  ok(v.results.length === 2 && v.counts.unplayed === 1 && v.counts.played === 2, "results and counts");
}

console.log(`PASSED — ${checks}/${checks} checks (competition adapters)`);
