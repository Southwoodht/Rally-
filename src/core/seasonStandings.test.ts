import { seasonClosedPost, seasonMatches, seasonPodium } from "./seasonStandings";

let passed = 0, total = 0;
const check = (name: string, ok: boolean) => {
  total++;
  if (ok) passed++; else console.error("FAIL: " + name);
};

const at = (iso: string) => new Date(iso).getTime();
const players = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() }));
let n = 0;
const m = (p1: string, p2: string, winner: string, date: string, logged?: string) =>
  ({ id: "m" + n++, p1, p2, winner, date: at(date), loggedAt: logged ? at(logged) : at(date), status: "confirmed" });

const season = { startsOn: "2026-11-01", endsOn: "2027-03-31", endedAt: at("2027-04-01T08:00:00Z") };
const matches = [
  m("a", "b", "p1", "2026-11-10T18:00:00Z"),
  m("a", "c", "p1", "2026-12-10T18:00:00Z"),
  m("b", "c", "p1", "2027-01-10T18:00:00Z"),
  m("a", "d", "p1", "2027-02-10T18:00:00Z"),
  m("c", "d", "p1", "2027-03-30T18:00:00Z"),
  m("d", "a", "p1", "2026-10-31T18:00:00Z"),                          // before the season
  m("d", "a", "p1", "2027-03-30T18:00:00Z", "2027-04-03T10:00:00Z"),  // played in it, logged after it closed
  { ...m("d", "b", "p1", "2027-01-05T18:00:00Z"), status: "pending" }, // logged, not yet agreed
];

const ms = seasonMatches(matches, season);
check("six matches count (pending counts, as on every table)", ms.length === 6);
check("a match before the start is out", !ms.some((x) => x.date === at("2026-10-31T18:00:00Z")));
check("a result logged after the close is out", !ms.some((x) => x.loggedAt === at("2027-04-03T10:00:00Z")));
check("an unconfirmed result counts, as on every table", ms.some((x) => x.status === "pending"));
check("while running, a late log still counts", seasonMatches(matches, { ...season, endedAt: null }).length === 7);

// The podium is the Table's ranking (Glicko), established players only. A
// round robin played eight times over, close enough that every ± settles:
// the better player wins each pairing six times in eight. (An unbeaten run
// against much weaker players keeps a wide ± — it says little — which is
// Glicko working, and why the real club's leader sits at ± 87.)
const rounds: any[] = [];
const pairs: Array<[string, string]> = [["a", "b"], ["a", "c"], ["b", "c"], ["a", "d"], ["b", "d"], ["c", "d"]];
for (let r = 0; r < 8; r++) {
  pairs.forEach(([x, y], k) => {
    const upset = (r + k) % 4 === 0; // 2 of every 8
    rounds.push(m(x, y, upset ? "p2" : "p1", new Date(Date.UTC(2026, 10, 2 + r * 7 + k, 18)).toISOString()));
  });
}
const pod = seasonPodium(players, rounds, season);
check("clean order: A, B, C", pod.map((p) => p.playerId + p.place).join() === "a1,b2,c3");
check("the podium carries the rating", pod[0].points > pod[1].points && pod[1].points > pod[2].points);
check("three matches each is not enough to be placed: no podium", seasonPodium(players, rounds.slice(0, 6), season).length === 0);
check("cut-off keeps people off", seasonPodium(players, rounds, season, 40).length === 0);

const post = seasonClosedPost("Winter 2026/27", [{ name: "Zaach Rodriguez", place: 1 }, { name: "Sam Henry", place: 2 }], [{ competition: "Group A", name: "Zaach Rodriguez" }]);
check("post names the season and the Player of the Season", post.startsWith("Winter 2026/27 is over. Player of the Season: Zaach Rodriguez · 2nd: Sam Henry."));
check("no podium: says nobody was placed", seasonClosedPost("W", [], []).includes("no Player of the Season"));
check("post names group winners", post.endsWith("Group A: Zaach Rodriguez."));

if (passed !== total) { console.error(`FAILED — ${passed}/${total} checks (season standings)`); process.exit(1); }
console.log(`PASSED — ${passed}/${total} checks (season standings)`);
