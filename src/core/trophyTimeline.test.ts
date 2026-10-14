import { guessFormat, onSide, honoursByYear, trophyDateLabel, trophyTitle, trophyTs, trophyYear } from "./trophyTimeline";
import { yearOf } from "./yearRecord";

let passed = 0, total = 0;
const check = (name: string, ok: boolean) => {
  total++;
  if (ok) passed++; else console.error("FAIL: " + name);
};

// Dated: placed late on the day, in the right London year even on 31 Dec.
const nye = { id: "a", competition: "Men's Singles", result: "Champion", won_on: "2026-12-31" };
check("31 Dec stays in its year", yearOf(trophyTs(nye)!) === 2026);
const summer = { id: "b", competition: "Club Cup", won_on: "2026-07-04" };
check("summer date stays on its London day", new Date(trophyTs(summer)!).toISOString().startsWith("2026-07-04"));
check("after that day's matches", trophyTs(summer)! > Date.UTC(2026, 6, 4, 19, 0));

// Undated: no timeline position, but a year when the season names one.
const old = { id: "c", competition: "Men's Singles", season: "2019" };
check("season-only has no timeline position", trophyTs(old) === null);
check("season-only still has a year", trophyYear(old) === 2019);
check("two-year season names no year", trophyYear({ id: "d", season: "2025/26" }) === null);
check("repeated year is still one year", trophyYear({ id: "e", season: "Summer 2024 (2024)" }) === 2024);
check("nothing at all is no year", trophyYear({ id: "f" }) === null);
check("won_on beats season", trophyYear({ id: "g", season: "2019", won_on: "2020-03-01" }) === 2020);
check("bad date is ignored", trophyTs({ id: "h", won_on: "yesterday" }) === null);

check("title with result", trophyTitle(nye) === "Champion — Men's Singles");
check("title without result", trophyTitle(summer) === "Club Cup");
check("date label", trophyDateLabel(summer) === "4 Jul 2026");

const h = honoursByYear([nye, summer, old, { id: "d", season: "2025/26" }]);
check("honours grouped by year, in order won", JSON.stringify(h[2026]) === JSON.stringify(["Club Cup", "Champion — Men's Singles"]));
check("undated honour under its season", h[2019]?.length === 1);
check("ambiguous season left out", Object.keys(h).length === 2);

// Sides: only an explicit doubles tag leaves the singles side.
check("doubles trophy on doubles side", onSide({ id: "x", format: "doubles" }, "doubles"));
check("doubles trophy not on singles side", !onSide({ id: "x", format: "doubles" }, "singles"));
check("untagged stays on singles side", onSide({ id: "x" }, "singles") && !onSide({ id: "x" }, "doubles"));
check("guess: Helen's Cup Fun Doubles", guessFormat("Helen’s Cup Fun Doubles") === "doubles");
check("guess: Mixed pairs", guessFormat("Summer mixed") === "doubles");
check("guess: Men's Singles", guessFormat("Men's Singles") === "singles");
check("guess: 'doubled' is not doubles", guessFormat("Prize doubled") === "singles");

if (passed !== total) { console.error(`FAILED — ${passed}/${total} checks (trophy timeline)`); process.exit(1); }
console.log(`PASSED — ${passed}/${total} checks (trophy timeline)`);
