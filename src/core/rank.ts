import { computeOfficial } from "@/core/official";
import { winPct } from "@/lib/format";

export function rankMaps(players, matches, elo, wdl) {
  const off = computeOfficial(players, matches, wdl);
  const avgOpp = {}; players.forEach((p) => { avgOpp[p.id] = { s: 0, n: 0 }; });
  matches.filter((m) => m.status !== "pending").forEach((m) => { if (avgOpp[m.p1]) { avgOpp[m.p1].s += (elo[m.p2] ?? 0); avgOpp[m.p1].n++; } if (avgOpp[m.p2]) { avgOpp[m.p2].s += (elo[m.p1] ?? 0); avgOpp[m.p2].n++; } });
  const rec = {}; players.forEach((p) => { const r = wdl[p.id] || { gp: 0 }; if (!r.gp) { rec[p.id] = -1e9; return; } const act = r.gp / (r.gp + 5); const ao = avgOpp[p.id].n ? avgOpp[p.id].s / avgOpp[p.id].n : 0; const of = Math.max(0.5, Math.min(2, 1 + ao / 200)); rec[p.id] = winPct(r) * act * of; });
  const eloMap = {}; players.forEach((p) => { eloMap[p.id] = wdl[p.id]?.gp ? (elo[p.id] ?? 0) : -1e9; });
  const played = players.filter((p) => wdl[p.id]?.gp && !p.inactive);
  const rankOf = (map) => { const sorted = [...played].sort((a, b) => (map[b.id] ?? -1e9) - (map[a.id] ?? -1e9)); const m = {}; sorted.forEach((p, i) => { m[p.id] = i + 1; }); return m; };
  return { off: rankOf(off), el: rankOf(eloMap), rec: rankOf(rec) };
}

export const WEEK = 7 * 86400000;

export function currentStreakOf(pid, matches) {
  const gs = matches.filter((m) => m.status !== "pending" && (m.p1 === pid || m.p2 === pid)).sort((a, b) => a.date - b.date);
  let s = 0;
  for (let i = gs.length - 1; i >= 0; i--) { const m = gs[i]; const won = (m.winner === "p1" && m.p1 === pid) || (m.winner === "p2" && m.p2 === pid); if (m.winner !== "draw" && won) s++; else break; }
  return s;
}
