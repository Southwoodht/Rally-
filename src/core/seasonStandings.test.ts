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

const pod = seasonPodium(players, matches, season);
check("a three-way tie for 2nd shares the place", pod.length === 4 && pod.slice(1).every((p) => p.place === 2));
check("A, unbeaten, is champion", pod[0].playerId === "a" && pod[0].place === 1);
const clean = [m("a", "b", "p1", "2026-11-10T18:00:00Z"), m("a", "c", "p1", "2026-11-11T18:00:00Z"), m("b", "c", "p1", "2026-11-12T18:00:00Z"), m("a", "d", "p1", "2026-11-13T18:00:00Z"), m("b", "d", "p1", "2026-11-14T18:00:00Z"), m("c", "d", "p1", "2026-11-15T18:00:00Z")];
const cleanPod = seasonPodium(players, clean, season);
check("clean order: A, B, C", cleanPod.map((p) => p.playerId + p.place).join() === "a1,b2,c3");
const six = [...["a", "b", "c", "d", "e", "f"]].map((id) => ({ id, name: id }));
const many: any[] = [];
["a", "b", "c", "d", "e", "f"].forEach((x, i, arr) => arr.slice(i + 1).forEach((y) => many.push(m(x, y, "p1", "2026-12-01T18:00:00Z"))));
check("six players: podium of three, no crash", seasonPodium(six, many, season).map((p) => p.playerId).join() === "a,b,c");
check("cut-off keeps people off", seasonPodium(players, matches, season, 4).length === 0);

const post = seasonClosedPost("Winter 2026/27", [{ name: "Zaach Rodriguez", place: 1 }, { name: "Sam Henry", place: 2 }], [{ competition: "Group A", name: "Zaach Rodriguez" }]);
check("post names the season and champion", post.startsWith("Winter 2026/27 is over. Champion: Zaach Rodriguez · 2nd: Sam Henry."));
check("post names group winners", post.endsWith("Group A: Zaach Rodriguez."));

if (passed !== total) { console.error(`FAILED — ${passed}/${total} checks (season standings)`); process.exit(1); }
console.log(`PASSED — ${passed}/${total} checks (season standings)`);
