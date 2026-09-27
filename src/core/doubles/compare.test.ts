/** Doubles Compare: two pairs side by side. Plain asserts. */
import { compareTeams } from "./compare";
import { predictDoubles, previewDoubles, type DoublesMatch } from "./elo";

let checks = 0;
const ok = (cond: boolean, what: string) => {
  checks++;
  if (!cond) { console.error("FAILED: " + what); process.exit(1); }
};
let n = 0;
const m = (teamA: [string, string | null], teamB: [string, string | null], winner: string, t: number, status = "confirmed"): DoublesMatch =>
  ({ id: "m" + (++n), playedAt: t, teamA, teamB, winner, status });

const matches = [
  m(["sam", "zac"], ["cha", "adr"], "A", 1),
  m(["adr", "cha"], ["zac", "sam"], "A", 2),        // same pairs, written the other way round
  m(["sam", "zac"], ["cha", "adr"], "draw", 3),
  m(["sam", "cha"], ["zac", "adr"], "A", 4),        // sam beats zac and adr with another partner
  m(["sam", "zac"], ["geo", null], "A", 5),         // together, against somebody else
  m(["sam", "zac"], ["cha", "adr"], "B", 6, "pending"), // pending: nowhere
];

const c = compareTeams(matches, ["sam", "zac"], ["cha", "adr"], 100);

ok(c.meetings.w === 1 && c.meetings.d === 1 && c.meetings.l === 1, "pair v pair counts both orientations, confirmed only");
ok(c.meetings.matches.length === 3 && c.meetings.matches[0].id === "m3", "meetings newest first");
ok(c.teams[0].together.played === 4 && c.teams[0].together.w === 2, "sam & zac together: four played, two won");
ok(c.teams[0].form.join("") === "WLDW", `form as a pair, oldest first — got ${c.teams[0].form.join("")}`);
ok(c.teams[1].together.played === 3, "cha & adr together: three");
ok(c.teams[0].rating === Math.round((c.teams[0].players[0].rating + c.teams[0].players[1].rating) / 2), "team rating is the average");

const cross = (a: string, b: string) => c.crossings.find((x) => x.a === a && x.b === b)!.record;
ok(c.crossings.length === 4, "every A player against every B player");
ok(cross("sam", "adr").w === 2 && cross("sam", "adr").l === 1 && cross("sam", "adr").d === 1, "sam v adr includes the match with another partner");
ok(cross("sam", "cha").w === 1 && cross("sam", "cha").l === 1, "partners are never opponents: sam and cha together is not sam v cha");

ok(c.chanceA === Math.round(predictDoubles(["sam", "zac"], ["cha", "adr"], c.stats) * 100), "the odds are the fixture odds, exactly");
ok(c.chanceA >= 0 && c.chanceA <= 100, "a percentage");
const real = previewDoubles(matches, { teamA: ["sam", "zac"], teamB: ["cha", "adr"], winner: "A", playedAt: 100 });
ok(real.every((d) => c.swing.ifA[d.playerId] === d.delta), "the swing is what saving would do");
ok(c.swing.ifA.sam > 0 && c.swing.ifB.sam < 0, "winning goes up, losing goes down");
ok(c.swing.ifA.cha < 0 && c.swing.ifB.cha > 0, "and the other way round for the other pair");

const fresh = compareTeams([], ["a", "b"], ["c", "d"], 1);
ok(fresh.chanceA === 50 && fresh.meetings.matches.length === 0 && fresh.teams[0].players[0].provisional, "nobody has played: even, provisional, nothing met");

console.log(`PASSED — ${checks}/${checks} checks (doubles compare)`);
