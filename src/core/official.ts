import { levelAt, levelVal } from "@/core/levels";
import { winPct } from "@/lib/format";

export function overallScore(p, elo, wdl) {
  const r = wdl[p.id] || { gp: 0, w: 0, d: 0, l: 0 };
  if (!r.gp) return -1e6;
  const e = elo[p.id] ?? 0;
  const wpTerm = (winPct(r) - 0.5) * 40;
  const activity = Math.min(r.gp, 20) * 0.5;
  return e + wpTerm + activity;
}

export function computeOfficial(players, matches, wdl) {
  const byId = {}; players.forEach((p) => { byId[p.id] = p; });
  const qual = {}; const winQuality = {}; players.forEach((p) => { qual[p.id] = 0; winQuality[p.id] = []; });
  matches.filter((m) => m.status !== "pending" && m.winner !== "draw").forEach((m) => {
    const wid = m.winner === "p1" ? m.p1 : m.p2, lid = m.winner === "p1" ? m.p2 : m.p1;
    const oppLv = levelVal(levelAt(byId[lid], m.date)) ?? 0;
    if (qual[wid] != null) { const q = 1 + oppLv / 4; qual[wid] += q; winQuality[wid].push(q); }
  });
  const score = {};
  players.forEach((p) => {
    const r = wdl[p.id] || { w: 0, d: 0, l: 0, gp: 0 };
    if (!r.gp) { score[p.id] = -1e6; return; }
    const list = (winQuality[p.id] || []).sort((a, b) => b - a).slice(0, 5); // your five best wins
    if (!list.length) { score[p.id] = 0; return; }
    const qualPerWin = list.reduce((a, b) => a + b, 0) / list.length;
    const wrReg = (r.w + 0.5 * r.d + 1) / (r.gp + 2); // win rate (counted twice below, so it bites)
    const activity = r.gp / (r.gp + 10);           // playing more counts, but saturates
    score[p.id] = qualPerWin * wrReg * wrReg * activity * 100;
  });
  return score;
}
