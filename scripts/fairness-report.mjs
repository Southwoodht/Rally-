// Runs the rating fairness check (src/core/fairness.ts) over an export from
// supabase/export_fairness_data.sql. Build the core first:
//
//   npx tsc -p tsconfig.test.json
//   node scripts/fairness-report.mjs path/to/seacourt.json [--year 2026]
//
// The JSON stays outside the repo (real names).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { fairnessReport } = require("../.test-out/core/fairness.js");

const file = process.argv[2];
const yearArg = process.argv.indexOf("--year");
const year = yearArg > 0 ? Number(process.argv[yearArg + 1]) : null;
let raw = JSON.parse(readFileSync(file, "utf8"));
if (raw.seacourt) raw = raw.seacourt;

const players = raw.players.map((p) => ({
  id: p.id, name: p.name, last: p.last, inactive: p.inactive,
  level: p.level, levelHistory: p.level_history ?? undefined,
  levelEstimate: p.level_estimate ?? null, levelEstimateHistory: p.level_estimate_history ?? undefined,
  initialRecord: p.initial_record ?? undefined, initialElo: p.initial_elo ?? undefined,
}));
let matches = raw.matches.map((m) => ({
  id: m.id, p1: m.p1, p2: m.p2, winner: m.winner, score: m.score, status: m.status,
  date: new Date(m.date).getTime(), loggedAt: m.created_at ? new Date(m.created_at).getTime() : undefined,
}));
if (year) matches = matches.filter((m) => new Date(m.date).getUTCFullYear() === year);

const name = (id) => { const p = players.find((x) => x.id === id); return p ? `${p.name}${p.last ? " " + p.last : ""}` : id; };
const rep = fairnessReport(players, matches);
console.log(`Top player: ${name(rep.topId)}  (${matches.length} matches${year ? " in " + year : ""})\n`);
console.log("Against the top player — rating with those matches → without them");
console.log("player".padEnd(24), "W-D-L".padEnd(8), "Official".padEnd(18), "Elo".padEnd(20), "Strength");
for (const r of rep.rows) {
  const f = (a, b) => `${a} → ${b} (${b - a >= 0 ? "+" : ""}${(b - a).toFixed(1)})`;
  console.log(name(r.playerId).padEnd(24), `${r.w}-${r.d}-${r.l}`.padEnd(8),
    f(r.with.official, r.without.official).padEnd(18), f(r.with.elo, r.without.elo).padEnd(20), f(r.with.strength, r.without.strength));
}
console.log(`\nLosses checked: ${rep.lossesChecked}. Losses that RAISED the loser's Official: ${rep.lossesThatRaisedOfficial.length}`);
for (const l of rep.lossesThatRaisedOfficial.slice(0, 25)) console.log(`  ${name(l.playerId)} lost to ${name(l.opponentId)}: +${l.by}`);
