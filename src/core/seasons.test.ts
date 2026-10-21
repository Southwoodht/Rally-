import {
  addDays, daysLeft, daysLeftLabel, inSeason, isDueToClose, londonDay, londonDayStart,
  roundDeadlines, seasonFromLegacy, seasonWindow, tieState, type Season,
} from "./seasons";

let passed = 0, total = 0;
const check = (name: string, ok: boolean) => {
  total++;
  if (ok) passed++; else console.error("FAIL: " + name);
};

const winter: Season = { id: "w", leagueId: "L", name: "Winter 2026/27", startsOn: "2026-11-01", endsOn: "2027-03-31", status: "active", endedAt: null };
const at = (iso: string) => new Date(iso).getTime();

// UK days, both sides of the clocks changing.
check("summer midnight is 23:00 UTC the day before", londonDayStart("2026-07-01") === at("2026-06-30T23:00:00Z"));
check("winter midnight is 00:00 UTC", londonDayStart("2026-12-01") === at("2026-12-01T00:00:00Z"));
check("londonDay after midnight BST", londonDay(at("2026-06-30T23:30:00Z")) === "2026-07-01");
check("addDays over a month end", addDays("2027-02-27", 2) === "2027-03-01");

// Membership: first and last moments of the season.
check("first minute of 1 Nov is in", inSeason(winter, at("2026-11-01T00:01:00Z")));
check("31 Oct evening is out", !inSeason(winter, at("2026-10-31T22:00:00Z")));
check("31 Mar 11pm BST is in", inSeason(winter, at("2027-03-31T22:00:00Z")));
check("1 Apr 00:30 BST is out", !inSeason(winter, at("2027-03-31T23:30:00Z")));
check("open-ended season has no end", seasonWindow({ startsOn: "2026-01-01", endsOn: null }).end === null);

// Countdown.
check("days left from 21 Nov", daysLeft(winter, at("2026-11-21T12:00:00Z")) === 130);
check("last day label", daysLeftLabel(winter, at("2027-03-31T12:00:00Z")) === "Last day");
check("one day label", daysLeftLabel(winter, at("2027-03-30T12:00:00Z")) === "1 day left");
check("ended label", daysLeftLabel({ ...winter, status: "ended" }) === "Ended");

// Closing.
check("not due on its last day", !isDueToClose(winter, at("2027-03-31T20:00:00Z")));
check("due the day after", isDueToClose(winter, at("2027-04-01T09:00:00Z")));
check("open-ended never due", !isDueToClose({ ...winter, endsOn: null }, at("2030-01-01T00:00:00Z")));

// Deadlines: evenly spread, last one is the season's last day.
const five = roundDeadlines("2026-11-01", "2027-03-31", 5);
check("five rounds", five.length === 5);
check("last deadline is the last day", five[4] === "2027-03-31");
check("first deadline ~30 days in", five[0] === "2026-12-01");
check("deadlines increase", five.every((d, i) => i === 0 || d > five[i - 1]));
check("ten rounds every ~15 days", roundDeadlines("2026-11-01", "2027-03-31", 10)[0] === "2026-11-16");
check("no rounds, no dates", roundDeadlines("2026-11-01", "2027-03-31", 0).length === 0);

// Tie states.
const now = at("2026-12-05T12:00:00Z");
check("played beats overdue", tieState({ done: true, playBy: "2026-12-01" }, now) === "played");
check("overdue after play-by", tieState({ playBy: "2026-12-01" }, now) === "overdue");
check("open on its play-by day", tieState({ playBy: "2026-12-05" }, now) === "open");
check("walkover", tieState({ outcome: "walkover_p2", playBy: "2026-12-01" }, now) === "walkover");
check("void", tieState({ outcome: "void" }, now) === "void");

// The old settings-blob season, as the date inputs stored it.
const legacy = seasonFromLegacy("L", { name: "Test League", start: at("2026-01-01T00:00:00Z"), end: at("2026-12-31T00:00:00Z") });
check("legacy season reads", !!legacy && legacy.startsOn === "2026-01-01" && legacy.endsOn === "2026-12-31" && legacy.status === "active");
check("no legacy season", seasonFromLegacy("L", null) === null);

if (passed !== total) { console.error(`FAILED — ${passed}/${total} checks (seasons)`); process.exit(1); }
console.log(`PASSED — ${passed}/${total} checks (seasons)`);
