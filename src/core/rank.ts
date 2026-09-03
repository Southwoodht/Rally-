import { computeStats } from "@/core/elo";
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

const rankFromOfficial = (players, offMap, wdl) => {
  const played = players.filter((p) => (wdl[p.id]?.gp || 0) > 0 && !p.inactive);
  const sorted = [...played].sort((a, b) => (offMap[b.id] ?? -1e9) - (offMap[a.id] ?? -1e9));
  const m: Record<string, number> = {};
  sorted.forEach((p, i) => { m[p.id] = i + 1; });
  return m;
};

// Reconstructs ELO and Official rank exactly as they stood immediately before
// and after one specific match, by replaying the confirmed match history up
// to that point. Only meaningful for confirmed matches — a still-pending
// result hasn't been folded into anyone's rating yet, so this returns null
// rather than showing a number that doesn't reflect reality.
export function matchContext(players, matches, target) {
  if (!target || target.status === "pending") return null;
  const confirmed = [...matches].filter((m) => m.status !== "pending").sort((a, b) => a.date - b.date);
  const idx = confirmed.findIndex((m) => m.id === target.id);
  if (idx === -1) return null;
  const before = confirmed.slice(0, idx);
  const upTo = confirmed.slice(0, idx + 1);
  const statsBefore = computeStats(players, before);
  const statsAfter = computeStats(players, upTo);
  const offBefore = computeOfficial(players, before, statsBefore.wdl);
  const offAfter = computeOfficial(players, upTo, statsAfter.wdl);
  const rankBefore = rankFromOfficial(players, offBefore, statsBefore.wdl);
  const rankAfter = rankFromOfficial(players, offAfter, statsAfter.wdl);
  return {
    eloBefore: { p1: statsBefore.elo[target.p1] ?? null, p2: statsBefore.elo[target.p2] ?? null },
    eloAfter: { p1: statsAfter.elo[target.p1] ?? null, p2: statsAfter.elo[target.p2] ?? null },
    rankBefore: { p1: rankBefore[target.p1] ?? null, p2: rankBefore[target.p2] ?? null },
    rankAfter: { p1: rankAfter[target.p1] ?? null, p2: rankAfter[target.p2] ?? null },
    // Official points were already computed here to work the ranks out; they
    // were just never handed back, so a match could say someone moved from
    // 5th to 6th without saying by how much.
    ptsBefore: { p1: offBefore[target.p1] ?? null, p2: offBefore[target.p2] ?? null },
    ptsAfter: { p1: offAfter[target.p1] ?? null, p2: offAfter[target.p2] ?? null },
  };
}
