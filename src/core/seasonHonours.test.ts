// Tests for season honours (core/seasonHonours.ts).
// Plain TypeScript with an assert; relative imports (see CLAUDE.md §1).

import { seasonHonours } from "./seasonHonours";

let failures = 0;
let checks = 0;
function ok(cond: boolean, what: string) {
  checks++;
  if (!cond) { failures++; console.error(`  FAIL ${what}`); }
}

const players = ["a", "b", "c", "d"].map((id) => ({ id, name: id }));
let n = 0;
const m = (p1: string, p2: string, winner: string, ts: number) => ({ id: "m" + n++, p1, p2, winner, date: ts, loggedAt: ts, status: "confirmed" });
// Eight rounds of a close round robin, as in seasonStandings.test: A best.
const matches: any[] = [];
const pairs: Array<[string, string]> = [["a", "b"], ["a", "c"], ["b", "c"], ["a", "d"], ["b", "d"], ["c", "d"]];
for (let r = 0; r < 8; r++) pairs.forEach(([x, y], k) => matches.push(m(x, y, (r + k) % 4 === 0 ? "p2" : "p1", Date.UTC(2026, 10, 2 + r * 7 + k, 18))));

const ended = { id: "s1", leagueId: "L", name: "Winter 2026/27", startsOn: "2026-11-01", endsOn: "2027-03-31", status: "ended" as const, endedAt: Date.UTC(2027, 3, 1) };
const running = { ...ended, id: "s2", name: "Spring 2027", startsOn: "2027-04-01", endsOn: "2027-06-30", status: "active" as const, endedAt: null };

const div1 = { id: "d1", leagueId: "L", name: "Division 1", kind: "singles" as const, format: "league" as const, legs: 2, pointsWin: 3, pointsDraw: 1, status: "running" as const, createdBy: null, createdAt: 0, seasonId: "s1" };
const div2 = { ...div1, id: "d2", name: "Division 2" };
const cup = { ...div1, id: "k1", name: "Cup", format: "knockout" as const };
const doubles = { ...div1, id: "dd", name: "Doubles Division", kind: "doubles" as const };
const entries = [
  { id: "e1", competitionId: "d1", p1: "a", p2: null, seed: 1 }, { id: "e2", competitionId: "d1", p1: "b", p2: null, seed: 2 },
  { id: "e3", competitionId: "d2", p1: "c", p2: null, seed: 1 }, { id: "e4", competitionId: "d2", p1: "d", p2: null, seed: 2 },
  { id: "e5", competitionId: "dd", p1: "a", p2: "c", seed: 1 }, { id: "e6", competitionId: "dd", p1: "b", p2: "d", seed: 2 },
];
const results: Record<string, any[]> = {
  d1: [{ pairA: "e2", pairB: "e1", winner: "A", sets: [] }],   // B wins Division 1
  d2: [],                                                      // nothing played: no winner
  dd: [{ pairA: "e5", pairB: "e6", winner: "A", sets: [] }],   // A & C win the doubles
};

const h = seasonHonours({ players, matches, seasons: [ended, running], competitions: [div1, div2, cup, doubles], entries, resultsOf: (c) => results[c.id] || [], minGames: 3 });
const has = (pid: string, comp: string) => h.some((x) => x.playerId === pid && x.competition === comp);

ok(has("a", "Player of the Season"), "A, top of the season's table, is Player of the Season");
ok(h.filter((x) => x.competition === "Player of the Season").length === 1, "one Player of the Season");
ok(has("b", "Division 1"), "B won Division 1");
ok(!h.some((x) => x.competition === "Division 2"), "a division with nothing played crowns nobody");
ok(!h.some((x) => x.competition === "Cup"), "a knockout is not a division");
ok(has("a", "Doubles Division") && has("c", "Doubles Division"), "both partners get the doubles honour");
ok(h.find((x) => x.competition === "Doubles Division")?.format === "doubles", "and it is marked doubles");
ok(h.every((x) => x.season === "Winter 2026/27" && x.wonOn === "2027-03-31"), "dated the season's last day, named for it");
ok(!seasonHonours({ players, matches, seasons: [running], competitions: [{ ...div1, seasonId: "s2" }], entries, resultsOf: (c) => results.d1, minGames: 3 }).length, "a running season gives nothing yet");

if (failures) { console.error(`\nFAILED — ${failures} of ${checks} checks`); process.exit(1); }
console.log(`PASSED — ${checks}/${checks} checks (season honours)`);
