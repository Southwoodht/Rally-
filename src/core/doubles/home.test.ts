/** The doubles Home's numbers. Plain asserts. */
import { doublesHome } from "./home";
import type { DoublesMatch } from "./elo";

let checks = 0;
const ok = (cond: boolean, what: string) => {
  checks++;
  if (!cond) { console.error("FAILED: " + what); process.exit(1); }
};
const DAY = 86400000;
// Wed 23 Sep 2026, 12:00 local — so "this week" began Mon 21 Sep.
const NOW = new Date(2026, 8, 23, 12, 0, 0).getTime();
let n = 0;
const m = (teamA: [string, string | null], teamB: [string, string | null], winner: string, daysAgo: number, status = "confirmed"): DoublesMatch =>
  ({ id: "m" + (++n), playedAt: NOW - daysAgo * DAY, teamA, teamB, winner, status });
const players = ["me", "p", "x", "y", "q", "z", "far", "idle"].map((id) => ({ id, name: id, inactive: id === "idle" }));

// ---------------------------------------------------------------- nothing yet
{
  const h = doublesHome([], players, "me", [], NOW);
  ok(h.standing === null && h.lastMatch === null && h.daysSince === null, "nothing played: no standing, no last match");
  ok(h.periods.length === 3 && h.periods.every((p) => p.w === 0 && p.l === 0 && !p.matches.length), "three empty periods, still present");
  ok(h.suggestions.length === 0, "no rating yet: no suggestions");
}

// ---------------------------------------------------------------- a season
const matches = [
  m(["me", "p"], ["x", "y"], "A", 400),       // last year
  m(["x", "me"], ["q", "y"], "B", 31),        // 23 Aug: this year only
  m(["me", "p"], ["x", null], "A", 5),        // Fri 18 Sep: this month, not this week
  m(["q", "z"], ["me", "p"], "B", 1),         // Tue 22 Sep: this week, a win from side B
  m(["me", "p"], ["x", "y"], "draw", 0.5),    // Wed 23 Sep: this week, a draw
  m(["me", "p"], ["q", "z"], "B", 0.1, "pending"), // pending: never counted
];
const h = doublesHome(matches, players, "me", [], NOW);

ok(h.standing!.played === 5, `five confirmed doubles — got ${h.standing!.played}`);
ok(typeof h.standing!.rank === "number", "five played is the threshold: placed");
ok(h.standing!.form.join("") === "WLWWD", `form oldest first — got ${h.standing!.form.join("")}`);

const [week, month, year] = h.periods;
ok(week.w === 1 && week.d === 1 && week.l === 0, `this week: the side-B win and the draw — got ${week.w}-${week.d}-${week.l}`);
ok(week.matches.length === 2 && week.matches[0].playedAt > week.matches[1].playedAt, "newest first");
ok(month.w === 2 && month.d === 1 && month.l === 0, "this month adds Friday's win");
ok(year.w === 2 && year.l === 1 && year.d === 1, "this year adds August's loss, not last year's win");
ok(week.opponents === 4, `this week faced q, z, x, y — got ${week.opponents}`);
ok(month.opponents === 4, "an unknown opponent is not counted as a person");

ok(h.daysSince === 0, "last played today");
ok(h.lastMatch!.outcome === "D" && h.lastMatch!.partner === "p", "last match: the draw with p");

// Suggestions: never me, never inactive, never somebody with no doubles.
ok(h.suggestions.length === 2, "two suggestions");
ok(h.suggestions.every((s) => s.id !== "me" && s.id !== "idle" && s.id !== "far"), "not me, not inactive, not unrated");
ok(h.suggestions.every((s) => s.reason === "close"), "everyone here played in the last 60 days");

// Pending results are not a match anywhere on this page.
const onlyPending = doublesHome([m(["me", "p"], ["x", "y"], "A", 1, "pending")], players, "me", [], NOW);
ok(onlyPending.standing === null && onlyPending.daysSince === null, "a pending result is not yet played");

// ---------------------------------------------------------------- next booking
{
  const fixtures = [
    { id: "past", teamA: ["me", "p"] as [string, string], teamB: ["x", "y"] as [string, string], booked: NOW - DAY, done: false },
    { id: "later", teamA: ["x", "y"] as [string, string], teamB: ["me", "q"] as [string, string], booked: NOW + 5 * DAY, done: false },
    { id: "soon", teamA: ["q", "z"] as [string, string], teamB: ["p", "me"] as [string, string], booked: NOW + DAY, done: false },
    { id: "notmine", teamA: ["x", "y"] as [string, string], teamB: ["q", "z"] as [string, string], booked: NOW + 3600, done: false },
  ];
  const nu = doublesHome(matches, players, "me", fixtures, NOW).nextUp!;
  ok(nu.fixtureId === "soon", "the soonest booking of mine, not a past one or somebody else's");
  ok(nu.partner === "p" && nu.opponents.join() === "q,z", "partner and opponents from my side of the net");
  ok(nu.winChance >= 0 && nu.winChance <= 100, "a percentage");
}

console.log(`PASSED — ${checks}/${checks} checks (doubles home)`);
