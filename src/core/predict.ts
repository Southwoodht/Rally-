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
  const find = (id) => (players || []).find((p) => p.id === id);
  // Recent form is only meaningful relative to who it was against — beating
  // weaker players over and over says little about how you'll do against
  // someone tougher. Each result is weighted by the level gap (opponent
  // minus you, at the time) as well as recency, so a win over someone above
  // you counts for more than a win over someone well below you, and vice
  // versa for a loss. Unrated matches fall back to an even weight.
  const formRate = (pid) => {
    const gs = matches.filter((m) => m.status !== "pending" && (m.p1 === pid || m.p2 === pid)).sort((x, y) => y.date - x.date).slice(0, 8);
    const me = find(pid);
    let sc = 0, wSum = 0;
    gs.forEach((m, i) => {
      const oppId = m.p1 === pid ? m.p2 : m.p1;
      const myLv = levelVal(levelAt(me, m.date));
      const oppLv = levelVal(levelAt(find(oppId), m.date));
      const gap = myLv != null && oppLv != null ? Math.max(-3, Math.min(3, oppLv - myLv)) : 0;
      const w = Math.pow(0.85, i) * Math.pow(1.15, gap);
      let s; if (m.winner === "draw") s = 0.5; else { const won = (m.winner === "p1" && m.p1 === pid) || (m.winner === "p2" && m.p2 === pid); s = won ? 1 : 0; }
      sc += w * s; wSum += w;
    });
    return wSum > 0 ? (sc + 1) / (wSum + 2) : 0.5;
  };
  const fA = formRate(a), fB = formRate(b);
  const formExp = (fA + fB) > 0 ? fA / (fA + fB) : 0.5;
  const formWeight = 0.15;
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

// Every distinct venue recorded on any match — used to offer a venue picker
// only when there's actually more than one place people have logged games,
// rather than cluttering Compare with a picker that has nothing to pick.
export function venuesFor(matches: any[]): string[] {
  const set = new Set<string>();
  (matches || []).forEach((m) => { const v = (m.venue || "").trim(); if (v) set.add(v); });
  return Array.from(set).sort((x, y) => x.localeCompare(y));
}

const MIN_VENUE_GAMES = 3;

// A venue-conditioned prediction, deliberately conservative: it only nudges
// away from the overall prediction once both players have a real sample of
// games at that specific venue, and even then the venue signal is a minor
// blend on top of the real prediction, never the whole story. With a thin
// sample it just returns the ordinary prediction with confident: false, so
// callers can say "not enough data" instead of inventing a home advantage.
export function predictProbAtVenue(a, b, matches, elo, players, venue: string): { pct: number; confident: boolean } {
  const basePct = Math.round(predictProb(a, b, matches, elo, players) * 100);
  const v = (venue || "").trim().toLowerCase();
  if (!v) return { pct: basePct, confident: false };
  const atVenue = (pid) => (matches || []).filter((m) => m.status !== "pending" && (m.p1 === pid || m.p2 === pid) && (m.venue || "").trim().toLowerCase() === v);
  const gA = atVenue(a), gB = atVenue(b);
  if (gA.length < MIN_VENUE_GAMES || gB.length < MIN_VENUE_GAMES) return { pct: basePct, confident: false };
  const rate = (games, pid) => {
    let sc = 0;
    games.forEach((m) => { if (m.winner === "draw") sc += 0.5; else { const won = (m.winner === "p1" && m.p1 === pid) || (m.winner === "p2" && m.p2 === pid); sc += won ? 1 : 0; } });
    return (sc + 1) / (games.length + 2);
  };
  const rA = rate(gA, a), rB = rate(gB, b);
  const venuePct = (rA + rB) > 0 ? (rA / (rA + rB)) * 100 : 50;
  const blended = basePct * 0.7 + venuePct * 0.3;
  return { pct: Math.round(Math.max(5, Math.min(95, blended))), confident: true };
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
