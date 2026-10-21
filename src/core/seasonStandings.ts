import { computeStats } from "./elo";
import { countsAsPlayed } from "./matchStatus";
import { computeOfficial } from "./official";
import { inSeason, type Season } from "./seasons";

/**
 * A season's results, frozen the moment it ended.
 *
 * Brief item 1: "When a season ends ... the final standings are frozen".
 * Standings here are never stored — they are recomputed from matches, the
 * same principle as every table in the app — so "frozen" has to be a rule
 * about WHICH matches count rather than a saved copy:
 *
 *   * played on a day inside the season (UK clock), and
 *   * once the season has ended, logged before it ended.
 *
 * A result entered in April for a match played on 30 March is real, but it
 * arrived after the champion was announced, and a podium that rearranges
 * itself a week after the post went out is worse than one that leaves a late
 * result off. That match still counts everywhere else — all time, ratings —
 * just not in a season that has already been decided.
 *
 * What counts as played is countsAsPlayed, as on every table — which since
 * 2026-09-10 includes a result logged and not yet agreed.
 */
export function seasonMatches(matches: any[], season: Pick<Season, "startsOn" | "endsOn" | "endedAt">): any[] {
  return (matches || []).filter((m) =>
    countsAsPlayed(m)
    && inSeason(season, m.date)
    && (season.endedAt == null || (m.loggedAt ?? m.date) <= season.endedAt));
}

export interface PodiumPlace { playerId: string; place: number; points: number; played: number }

/**
 * The top three by Official over the season's matches — the table's default
 * order, so the podium and the table it sits above agree. `minGames` is the
 * table's cut-off: nobody stands on a podium the table would not rank.
 * Exactly level scores share a place (3, 3, 5).
 */
export function seasonPodium(players: any[], matches: any[], season: Pick<Season, "startsOn" | "endsOn" | "endedAt">, minGames = 1): PodiumPlace[] {
  const ms = seasonMatches(matches, season);
  const stats = computeStats(players, ms);
  const off = computeOfficial(players, ms, stats.wdl);
  const rows = players
    .map((p) => ({ playerId: p.id, points: off[p.id] ?? 0, played: stats.wdl[p.id]?.gp || 0 }))
    .filter((r) => r.played >= minGames)
    .sort((a, b) => b.points - a.points);
  const out: PodiumPlace[] = [];
  rows.forEach((r, i) => {
    const place = i > 0 && Math.abs(rows[i - 1].points - r.points) < 1e-9 ? out[i - 1].place : i + 1;
    if (place <= 3) out.push({ ...r, place });
  });
  return out;
}

/**
 * The announcement posted when a season closes. One sentence for the
 * season, one per competition that has a winner; names as given.
 */
export function seasonClosedPost(seasonName: string, podium: Array<{ name: string; place: number }>, competitionWinners: Array<{ competition: string; name: string }>): string {
  const ord = (n: number) => (n === 1 ? "Champion" : n === 2 ? "2nd" : "3rd");
  const parts = [`${seasonName} is over.`];
  if (podium.length) parts.push(podium.map((p) => `${ord(p.place)}: ${p.name}`).join(" · ") + ".");
  else parts.push("Not enough matches were played for a podium.");
  for (const c of competitionWinners) parts.push(`${c.competition}: ${c.name}.`);
  return parts.join(" ");
}
