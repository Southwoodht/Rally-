import { fairnessReport, ratingsFor } from "./fairness";

let passed = 0, total = 0;
const check = (name: string, ok: boolean) => { total++; if (ok) passed++; else console.error("FAIL: " + name); };

const players = ["z", "c", "s", "a", "b"].map((id) => ({ id, name: id }));
let n = 0;
const day = (k: number) => Date.UTC(2026, 0, 1) + k * 86400000;
const m = (p1: string, p2: string, winner: string) => ({ id: "m" + n, p1, p2, winner, date: day(n++), status: "confirmed" });

// Z is clearly best. C plays Z a lot and loses 9 of 10; S never plays Z.
const ms: any[] = [];
for (let i = 0; i < 9; i++) ms.push(m("z", "c", "p1"));
ms.push(m("c", "z", "p1"));
for (let i = 0; i < 4; i++) { ms.push(m("c", "a", "p1")); ms.push(m("s", "a", "p1")); ms.push(m("b", "s", "p2")); ms.push(m("c", "b", "p1")); }
ms.push(m("z", "s", "p1")); ms.push(m("z", "a", "p1")); ms.push(m("z", "b", "p1"));

const rep = fairnessReport(players, ms);
check("top player found", rep.topId === "z");
const c = rep.rows.find((r) => r.playerId === "c")!;
check("C's record against Z", c.w === 1 && c.l === 9 && c.d === 0);
check("ratings both ways are numbers", [c.with.official, c.without.official, c.with.elo, c.without.elo, c.with.strength, c.without.strength].every(Number.isFinite));
check("every Z opponent reported", rep.rows.length === 4);
check("every decided match checked as a loss", rep.lossesChecked === ms.length);

// The constructed case from the 2026-10-21 investigation: 3 wins and 2
// losses, then one more loss to the best player. Before that day's fix the
// activity term grew with every match played and a loss to a much stronger
// player cost only 0.4, so this loss RAISED Official. Losses are no longer
// activity (Sam's ruling), so it must now lower it, and the report must say
// so by not listing it.
{
  const ps = ["x", "top", "p", "q"].map((id) => ({ id, name: id }));
  n = 0;
  const base = [m("x", "p", "p1"), m("x", "q", "p1"), m("x", "p", "p1"), m("p", "x", "p1"), m("q", "x", "p1")];
  for (let i = 0; i < 6; i++) base.push(m("top", i % 2 ? "p" : "q", "p1"));
  const before = ratingsFor(ps, base).official.x;
  const after = ratingsFor(ps, [...base, m("top", "x", "p1")]).official.x;
  check(`a loss to the best player lowers Official (${before.toFixed(1)} → ${after.toFixed(1)})`, after < before);
  const r = fairnessReport(ps, [...base, m("top", "x", "p1")]);
  check("and the report finds no loss that raised anybody", r.lossesThatRaisedOfficial.length === 0);
}

if (passed !== total) { console.error(`FAILED — ${passed}/${total} checks (fairness)`); process.exit(1); }
console.log(`PASSED — ${passed}/${total} checks (fairness)`);
