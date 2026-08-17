import { levelAt, levelVal } from "@/core/levels";

export function predictProb(a, b, matches, elo, players) {
  const eA = (elo && elo[a]) || 0, eB = (elo && elo[b]) || 0;
  const eloExp = 1 / (1 + Math.pow(10, (eB - eA) / 400));
  const h2h = matches.filter((m) => m.status !== "pending" && ((m.p1 === a && m.p2 === b) || (m.p1 === b && m.p2 === a))).sort((x, y) => y.date - x.date);
  let aScore = 0, wSum = 0;
  h2h.forEach((m, i) => { const w = Math.pow(0.9, i); let s; if (m.winner === "draw") s = 0.5; else { const aWon = (m.winner === "p1" && m.p1 === a) || (m.winner === "p2" && m.p2 === a); s = aWon ? 1 : 0; } aScore += w * s; wSum += w; });
  const nH2H = h2h.length;
  const h2hRate = wSum > 0 ? (aScore + 1) / (wSum + 2) : 0.5;
  const h2hWeight = (Math.min(nH2H, 6) / 6) * 0.45;
  const formRate = (pid) => {
    const gs = matches.filter((m) => m.status !== "pending" && (m.p1 === pid || m.p2 === pid)).sort((x, y) => y.date - x.date).slice(0, 8);
    let sc = 0, n = 0; gs.forEach((m) => { if (m.winner === "draw") sc += 0.5; else { const won = (m.winner === "p1" && m.p1 === pid) || (m.winner === "p2" && m.p2 === pid); sc += won ? 1 : 0; } n++; });
    return n > 0 ? (sc + 1) / (n + 2) : 0.5;
  };
  const fA = formRate(a), fB = formRate(b);
  const formExp = (fA + fB) > 0 ? fA / (fA + fB) : 0.5;
  const formWeight = 0.15;
  const find = (id) => (players || []).find((p) => p.id === id);
  const lvA = levelVal(levelAt(find(a), Date.now()));
  const lvB = levelVal(levelAt(find(b), Date.now()));
  const haveLevels = lvA != null && lvB != null;
  const levelExp = haveLevels ? 1 / (1 + Math.pow(10, -0.15 * (lvA - lvB))) : 0.5;
  const eloWeight = Math.min(0.3, Math.max(0, 1 - h2hWeight - formWeight));
  const levelWeight = haveLevels ? Math.max(0, 1 - h2hWeight - formWeight - eloWeight) : 0;
  const rest = Math.max(0, 1 - h2hWeight - formWeight - eloWeight - levelWeight);
  const p = eloWeight * eloExp + h2hWeight * h2hRate + formWeight * formExp + levelWeight * levelExp + rest * eloExp;
  return Math.max(0.05, Math.min(0.95, p));
}

// Raw factors behind predictProb, for building a human-readable explanation.
// Deliberately returns numbers/facts only — no text — so callers can phrase it.
export function explainFactors(a, b, matches, elo, players) {
  const eA = (elo && elo[a]) || 0, eB = (elo && elo[b]) || 0;
  const confirmed = matches.filter((m) => m.status !== "pending");
  const h2h = confirmed.filter((m) => (m.p1 === a && m.p2 === b) || (m.p1 === b && m.p2 === a));
  let aw = 0, bw = 0, d = 0;
  h2h.forEach((m) => { if (m.winner === "draw") d++; else if ((m.winner === "p1" && m.p1 === a) || (m.winner === "p2" && m.p2 === a)) aw++; else bw++; });
  const formOf = (pid) => {
    const gs = confirmed.filter((m) => m.p1 === pid || m.p2 === pid).sort((x, y) => y.date - x.date).slice(0, 5);
    let w = 0, l = 0;
    gs.forEach((m) => { if (m.winner === "draw") return; const won = (m.winner === "p1" && m.p1 === pid) || (m.winner === "p2" && m.p2 === pid); if (won) w++; else l++; });
    return { w, l, n: gs.length };
  };
  const find = (id) => (players || []).find((p) => p.id === id);
  const lvA = levelVal(levelAt(find(a), Date.now()));
  const lvB = levelVal(levelAt(find(b), Date.now()));
  return {
    eloDiff: Math.round(eA - eB),
    h2h: { aw, bw, d, n: h2h.length },
    formA: formOf(a),
    formB: formOf(b),
    levelA: lvA,
    levelB: lvB,
  };
}
