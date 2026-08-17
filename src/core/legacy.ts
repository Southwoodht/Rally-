import { computeStats } from "@/core/elo";
import { levelAt, levelVal } from "@/core/levels";
import { winPct } from "@/lib/format";

// "Legacy" looks at a player's whole Rally career rather than just current
// form — see LeagueHome's Active/Legacy toggle. Everything here is derived
// live from confirmed matches, same rule as Achievements: no stored score,
// nothing invented. There's deliberately no single "Legacy Score" yet —
// transparent stats first, per the product direction.

export interface CareerRow {
  playerId: string;
  firstYear: number;
  lastYear: number;
  matches: number;
  w: number; d: number; l: number;
  winPct: number | null;
}

export function computeCareerTable(players: any[], matches: any[]): CareerRow[] {
  const confirmed = matches.filter((m) => m.status !== "pending");
  const rows: CareerRow[] = [];
  players.forEach((p) => {
    const bouts = confirmed.filter((m) => m.p1 === p.id || m.p2 === p.id);
    if (!bouts.length) return;
    const years = bouts.map((m) => new Date(m.date).getFullYear());
    let w = 0, d = 0, l = 0;
    bouts.forEach((m) => {
      if (m.winner === "draw") d++;
      else if ((m.winner === "p1" && m.p1 === p.id) || (m.winner === "p2" && m.p2 === p.id)) w++;
      else l++;
    });
    rows.push({ playerId: p.id, firstYear: Math.min(...years), lastYear: Math.max(...years), matches: bouts.length, w, d, l, winPct: winPct({ w, d, l, gp: bouts.length }) });
  });
  // Sorted by matches played — a plain, transparent proxy for career size.
  // Not a "score": ties broken by win rate, then by longest span.
  return rows.sort((a, b) => b.matches - a.matches || (b.winPct ?? 0) - (a.winPct ?? 0) || (b.lastYear - b.firstYear) - (a.lastYear - a.firstYear));
}

export interface RankedWin {
  oid: string;
  match: any;
  reason: string;
}

export interface RatingSplit {
  label: "higher" | "similar" | "lower";
  w: number; d: number; l: number;
  n: number;
}

export interface TimelineEntry {
  year: number;
  label: string;
}

export interface YearRecord {
  year: number;
  w: number; d: number; l: number;
  matches: number;
  winPct: number;
}

export interface CareerOpponent {
  oid: string;
  matches: number;
  w: number; d: number; l: number;
}

export interface LegacyProfile {
  firstYear: number | null;
  lastYear: number | null;
  matches: number;
  record: { w: number; d: number; l: number };
  winPct: number | null;
  matchesPerYear: number;
  activeThisYear: boolean;
  bestWins: RankedWin[];
  splits: RatingSplit[];
  timeline: TimelineEntry[];
  yearlyRecord: YearRecord[];
  topOpponents: CareerOpponent[];
}

// Only ever states what the match dates themselves show — a real gap in
// activity, not a guess at why. No "returned to regular tennis"-style
// storytelling; that would be inventing a reason Rally has no evidence for.
function computeTimeline(bouts: any[]): TimelineEntry[] {
  const years = Array.from(new Set(bouts.map((m) => new Date(m.date).getFullYear()))).sort((a, b) => a - b);
  if (!years.length) return [];
  const entries: TimelineEntry[] = [{ year: years[0], label: "First match recorded" }];
  for (let i = 1; i < years.length; i++) {
    const gap = years[i] - years[i - 1];
    if (gap > 1) entries.push({ year: years[i], label: `Returned after ${gap - 1} year${gap - 1 === 1 ? "" : "s"} away` });
  }
  const lastYear = years[years.length - 1];
  const alreadyCoversLastYear = entries[entries.length - 1]?.year === lastYear;
  if (lastYear === new Date().getFullYear() && years.length > 1 && !alreadyCoversLastYear) entries.push({ year: lastYear, label: "Active" });
  return entries;
}

// Pre-match ELO for every one of this player's confirmed matches, reusing
// computeStats over an increasing prefix of the FULL league history — the
// same replay technique core/rank.ts's matchContext uses for one match,
// just walked across a whole career.
function preMatchRatings(playerId: string, players: any[], confirmed: any[]) {
  const out: Record<string, { mine: number; opp: number }> = {};
  confirmed.forEach((m, i) => {
    if (m.p1 !== playerId && m.p2 !== playerId) return;
    const before = computeStats(players, confirmed.slice(0, i));
    const mine = m.p1 === playerId ? before.elo[m.p1] : before.elo[m.p2];
    const opp = m.p1 === playerId ? before.elo[m.p2] : before.elo[m.p1];
    out[m.id] = { mine: mine ?? 0, opp: opp ?? 0 };
  });
  return out;
}

export function computeLegacyProfile(playerId: string, players: any[], matches: any[]): LegacyProfile {
  const confirmed = matches.filter((m) => m.status !== "pending").sort((a, b) => a.date - b.date);
  const bouts = confirmed.filter((m) => m.p1 === playerId || m.p2 === playerId);
  const byId: Record<string, any> = {}; players.forEach((p) => { byId[p.id] = p; });
  const player = byId[playerId];
  const oppOf = (m: any) => (m.p1 === playerId ? m.p2 : m.p1);
  const resultFor = (m: any) => (m.winner === "draw" ? "D" : (m.winner === "p1" && m.p1 === playerId) || (m.winner === "p2" && m.p2 === playerId) ? "W" : "L");

  if (!bouts.length) {
    return { firstYear: null, lastYear: null, matches: 0, record: { w: 0, d: 0, l: 0 }, winPct: null, matchesPerYear: 0, activeThisYear: false, bestWins: [], splits: [], timeline: [], yearlyRecord: [], topOpponents: [] };
  }

  let rw = 0, rd = 0, rl = 0;
  bouts.forEach((m) => { const res = resultFor(m); if (res === "W") rw++; else if (res === "D") rd++; else rl++; });
  const record = { w: rw, d: rd, l: rl };

  const years = bouts.map((m) => new Date(m.date).getFullYear());
  const firstYear = Math.min(...years), lastYear = Math.max(...years);
  const span = Math.max(1, lastYear - firstYear + 1);
  const activeThisYear = lastYear === new Date().getFullYear();

  const pre = preMatchRatings(playerId, players, confirmed);
  const wins = bouts.filter((m) => resultFor(m) === "W").map((m) => {
    const oid = oppOf(m);
    const oppLv = levelVal(levelAt(byId[oid], m.date)) ?? 0;
    const myLv = levelVal(levelAt(player, m.date)) ?? 0;
    const upset = Math.max(0, oppLv - myLv);
    const oppElo = pre[m.id]?.opp ?? 0;
    return { oid, match: m, q: (oppLv + upset) * 1000 + oppElo };
  });
  const bestWins: RankedWin[] = [...wins].sort((a, b) => b.q - a.q).slice(0, 3).map((w, i) => ({
    oid: w.oid,
    match: w.match,
    reason: i === 0 ? "Highest-rated opponent defeated at the time." : "One of the strongest opponents defeated at the time.",
  }));

  const RATING_MARGIN = 50;
  const buckets: Record<"higher" | "similar" | "lower", { w: number; d: number; l: number }> = {
    higher: { w: 0, d: 0, l: 0 }, similar: { w: 0, d: 0, l: 0 }, lower: { w: 0, d: 0, l: 0 },
  };
  bouts.forEach((m) => {
    const r = pre[m.id];
    if (!r) return;
    const gap = r.opp - r.mine;
    const key = gap > RATING_MARGIN ? "higher" : gap < -RATING_MARGIN ? "lower" : "similar";
    const res = resultFor(m);
    if (res === "W") buckets[key].w++; else if (res === "D") buckets[key].d++; else buckets[key].l++;
  });
  const splits: RatingSplit[] = (["higher", "similar", "lower"] as const)
    .map((label) => ({ label, ...buckets[label], n: buckets[label].w + buckets[label].d + buckets[label].l }))
    .filter((s) => s.n > 0);

  const timeline = computeTimeline(bouts);

  const yearBuckets: Record<number, { w: number; d: number; l: number }> = {};
  bouts.forEach((m) => {
    const y = new Date(m.date).getFullYear();
    if (!yearBuckets[y]) yearBuckets[y] = { w: 0, d: 0, l: 0 };
    const res = resultFor(m);
    if (res === "W") yearBuckets[y].w++; else if (res === "D") yearBuckets[y].d++; else yearBuckets[y].l++;
  });
  const yearlyRecord: YearRecord[] = Object.keys(yearBuckets).map(Number).sort((a, b) => b - a).map((y) => {
    const r = yearBuckets[y];
    const matches = r.w + r.d + r.l;
    return { year: y, ...r, matches, winPct: winPct({ ...r, gp: matches }) };
  });

  const oppBuckets: Record<string, { w: number; d: number; l: number }> = {};
  bouts.forEach((m) => {
    const oid = oppOf(m);
    if (!oppBuckets[oid]) oppBuckets[oid] = { w: 0, d: 0, l: 0 };
    const res = resultFor(m);
    if (res === "W") oppBuckets[oid].w++; else if (res === "D") oppBuckets[oid].d++; else oppBuckets[oid].l++;
  });
  const topOpponents: CareerOpponent[] = Object.keys(oppBuckets)
    .map((oid) => { const r = oppBuckets[oid]; const matches = r.w + r.d + r.l; return { oid, matches, ...r }; })
    .sort((a, b) => b.matches - a.matches)
    .slice(0, 3);

  return {
    firstYear, lastYear,
    matches: bouts.length,
    record,
    winPct: winPct({ ...record, gp: bouts.length }),
    matchesPerYear: Math.round((bouts.length / span) * 10) / 10,
    activeThisYear,
    bestWins,
    splits,
    timeline,
    yearlyRecord,
    topOpponents,
  };
}
