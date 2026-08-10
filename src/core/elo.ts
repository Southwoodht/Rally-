import { K, LV_FACTOR, LV_MAX, LV_MIN, START_ELO } from "@/core/constants";
import { levelAt, levelVal } from "@/core/levels";
import { D } from "@/lib/format";

export function computeStats(players, matches) {
  const elo = {}, wdl = {}, form = {}, deltas = {}, byId = {};
  players.forEach((p) => {
    // Allow players to supply an initial ELO and an initial record so new users
    // can declare their existing history during onboarding. These fields are
    // optional: `initialElo` (number) and `initialRecord` ({w,d,l}). They are
    // merged into the computed stats before processing match history.
    elo[p.id] = typeof p.initialElo === 'number' ? p.initialElo : START_ELO;
    const ir = p.initialRecord || null;
    wdl[p.id] = ir ? { w: ir.w || 0, d: ir.d || 0, l: ir.l || 0, gp: (ir.w || 0) + (ir.d || 0) + (ir.l || 0) } : { w: 0, d: 0, l: 0, gp: 0 };
    form[p.id] = [];
    byId[p.id] = p;
  });
  [...matches].filter((m) => m.status !== "pending").sort((a, b) => a.date - b.date).forEach((m) => {
    if (!(m.p1 in elo) || !(m.p2 in elo)) return;
    const e1 = elo[m.p1], e2 = elo[m.p2];
    const exp1 = 1 / (1 + Math.pow(10, (e2 - e1) / 400));
    let s1;
    if (m.winner === "p1") { s1 = 1; wdl[m.p1].w++; wdl[m.p2].l++; form[m.p1].push("W"); form[m.p2].push("L"); }
    else if (m.winner === "p2") { s1 = 0; wdl[m.p2].w++; wdl[m.p1].l++; form[m.p2].push("W"); form[m.p1].push("L"); }
    else { s1 = 0.5; wdl[m.p1].d++; wdl[m.p2].d++; form[m.p1].push("D"); form[m.p2].push("D"); }
    wdl[m.p1].gp++; wdl[m.p2].gp++;
    let mult = 1;
    if (m.winner !== "draw") {
      const lv1 = levelVal(levelAt(byId[m.p1], m.date)) ?? 0, lv2 = levelVal(levelAt(byId[m.p2], m.date)) ?? 0;
      const winnerVal = m.winner === "p1" ? lv1 : lv2, loserVal = m.winner === "p1" ? lv2 : lv1;
      mult = Math.max(LV_MIN, Math.min(LV_MAX, 1 - LV_FACTOR * (winnerVal - loserVal)));
    }
    const d1 = K * (s1 - exp1) * mult, d2 = -d1;
    deltas[m.id] = { [m.p1]: d1, [m.p2]: d2 };
    elo[m.p1] = e1 + d1; elo[m.p2] = e2 + d2;
  });
  return { elo, wdl, form, deltas };
}
