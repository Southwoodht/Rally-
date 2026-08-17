import { computeAchievements } from "@/core/achievements";
import { computeStats } from "@/core/elo";
import { levelAt, levelVal } from "@/core/levels";
import { computeOfficial } from "@/core/official";
import { winPct } from "@/lib/format";

// Everything here is reconstructed from the actual recorded matches for the
// given calendar year — nothing invented. ELO/rank use the same replay
// technique as core/rank.ts's matchContext, just bounded to a year instead
// of a single match.
export function computeSeasonSummary(playerId: string, players: any[], matches: any[], year: number) {
  const yearStart = new Date(year, 0, 1).getTime();
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999).getTime();
  const confirmed = matches.filter((m) => m.status !== "pending");
  const beforeYear = confirmed.filter((m) => m.date < yearStart).sort((a, b) => a.date - b.date);
  const uptoEnd = confirmed.filter((m) => m.date <= yearEnd).sort((a, b) => a.date - b.date);
  const inYear = confirmed.filter((m) => m.date >= yearStart && m.date <= yearEnd);

  const statsBefore = computeStats(players, beforeYear);
  const statsEnd = computeStats(players, uptoEnd);
  const eloStart = statsBefore.elo[playerId] ?? null;
  const eloEnd = statsEnd.elo[playerId] ?? null;
  const eloChange = eloStart != null && eloEnd != null ? eloEnd - eloStart : null;

  const offEnd = computeOfficial(players, uptoEnd, statsEnd.wdl);
  const playedEnd = players.filter((p) => (statsEnd.wdl[p.id]?.gp || 0) > 0 && !p.inactive);
  const sortedEnd = [...playedEnd].sort((a, b) => (offEnd[b.id] ?? -1e9) - (offEnd[a.id] ?? -1e9));
  const rankIdx = sortedEnd.findIndex((p) => p.id === playerId);
  const officialRank = rankIdx >= 0 ? rankIdx + 1 : null;
  const officialOutOf = sortedEnd.length;

  const yearStats = computeStats(players, inYear);
  const r = yearStats.wdl[playerId] || { w: 0, d: 0, l: 0, gp: 0 };

  const bouts = inYear.filter((m) => m.p1 === playerId || m.p2 === playerId).sort((a, b) => a.date - b.date);
  const resultFor = (m: any) => (m.winner === "draw" ? "D" : (m.winner === "p1" && m.p1 === playerId) || (m.winner === "p2" && m.p2 === playerId) ? "W" : "L");
  const oppIdOf = (m: any) => (m.p1 === playerId ? m.p2 : m.p1);
  let bestStreak = 0, cur = 0;
  bouts.forEach((m) => { if (resultFor(m) === "W") { cur++; bestStreak = Math.max(bestStreak, cur); } else cur = 0; });

  const byId: Record<string, any> = {}; players.forEach((p) => { byId[p.id] = p; });
  const player = byId[playerId];
  const wins = bouts.filter((m) => resultFor(m) === "W").map((m) => {
    const oid = oppIdOf(m);
    const oppLv = levelVal(levelAt(byId[oid], m.date)) ?? 0;
    const myLv = levelVal(levelAt(player, m.date)) ?? 0;
    const upset = Math.max(0, oppLv - myLv);
    return { oid, match: m, q: (oppLv + upset) * 1000 + (yearStats.elo[oid] ?? 0) };
  });
  const biggestWin = wins.length ? [...wins].sort((a, b) => b.q - a.q)[0] : null;

  const achievements = computeAchievements(playerId, matches).filter((a) => a.achieved && a.date && new Date(a.date).getFullYear() === year);

  return { year, record: r, winPct: r.gp ? winPct(r) : null, eloStart, eloEnd, eloChange, officialRank, officialOutOf, bestStreak, biggestWin, matchesPlayed: r.gp, achievements };
}
