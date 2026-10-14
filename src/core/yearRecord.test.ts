/** Year headers on match history. Plain asserts; relative imports. */
import { recordsByYear, yearOf } from "./yearRecord";

let checks = 0;
const ok = (cond: boolean, what: string) => { checks++; if (!cond) { console.error("FAILED: " + what); process.exit(1); } };
const at = (y: number, m: number, d: number, h = 12) => Date.UTC(y, m - 1, d, h);

const r = recordsByYear([
  { date: at(2026, 3, 1), outcome: "W" },
  { date: at(2026, 4, 1), outcome: "W" },
  { date: at(2026, 5, 1), outcome: "D" },
  { date: at(2026, 6, 1), outcome: "L" },
  { date: at(2026, 7, 1), outcome: "W", pending: true },
  { date: at(2025, 8, 1), outcome: "L" },
]);
ok(r[2026].w === 2 && r[2026].d === 1 && r[2026].l === 1 && r[2026].played === 4, "a year's record, pending left out");
ok(r[2026].pct === 63, `a draw counts half — 2.5 of 4 is 63% — got ${r[2026].pct}`);
ok(r[2025].played === 1 && r[2025].pct === 0, "years are separate");
ok(!r[2024], "a year with nothing played has no header");
ok(yearOf(Date.UTC(2025, 11, 31, 23, 30)) === 2025, "late on New Year's Eve in UK time is still the old year");
ok(yearOf(Date.UTC(2026, 6, 31, 23, 30)) === 2026 && yearOf(Date.UTC(2025, 11, 31, 23, 59, 59)) === 2025, "UK clock, summer and winter");
console.log(`PASSED — ${checks}/${checks} checks (year record)`);
