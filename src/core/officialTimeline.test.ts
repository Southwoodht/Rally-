// Tests for core/officialTimeline.ts. Plain TypeScript with an assert;
// relative imports (see CLAUDE.md §1).
import { computeStats } from "./elo";
import { computeOfficial } from "./official";
import { officialTimeline } from "./officialTimeline";

let failures = 0;
let checks = 0;
function ok(cond: boolean, what: string) {
  checks++;
  if (!cond) { failures++; console.error(`  FAIL ${what}`); }
}
let seq = 0;
const M = (p1: string, p2: string, winner: string, status = "confirmed") => ({ id: "m" + (++seq), p1, p2, winner, score: "", status, date: Date.UTC(2026, 0, 1 + seq) });
const players = ["a", "b", "c", "d"].map((id) => ({ id, name: id }));
const matches = [M("a", "b", "p1"), M("b", "c", "p1"), M("c", "d", "p2"), M("a", "c", "p1"), M("d", "a", "p1"), M("b", "d", "draw"), M("a", "b", "p2", "pending"), M("c", "a", "p1", "short")];

const t = officialTimeline(players, matches);
const st = computeStats(players, matches.filter((m) => m.status !== "short"));
const table = computeOfficial(players, matches.filter((m) => m.status !== "short"), st.wdl);
for (const p of players) {
  const own = Object.values(t.perMatch).reduce((s, row) => s + (row[p.id] ?? 0), 0);
  ok(Math.abs(own + t.others[p.id] - (table[p.id] > -1e5 ? table[p.id] : 0)) < 1e-9, `${p.id}: own matches + others = the table's Official`);
}
ok(!(matches[7].id in t.perMatch), "a short match moves nothing and has no number");
ok(matches[6].id in t.perMatch, "an unconfirmed result counts, as on the table");
ok(Object.keys(t.perMatch[matches[0].id]).sort().join() === "a,b", "a match's row is only the two who played");
ok(t.perMatch[matches[0].id].a > 0 && t.perMatch[matches[0].id].b === 0, "first ever match: the winner gains, the loser stays at nothing");

if (failures) { console.error(`\nFAILED — ${failures} of ${checks} checks`); process.exit(1); }
console.log(`PASSED — ${checks}/${checks} checks (official timeline)`);
