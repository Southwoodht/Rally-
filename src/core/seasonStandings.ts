import { glickoStandings } from "./glicko";
import { countsAsPlayed } from "./matchStatus";
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
 * The season's top three on the Table's own ranking: Glicko over the season's
 * matches (core/glicko.ts), established players only, places shared as the
 * Table shares them. `minGames` is the table's cut-off.
 *
 * It was Official until 2026-10-22, when the Table became Glicko only; a
 * podium on another ranking than the table it sits above would crown
 * somebody the table puts second. Provisional players are not on it — the
 * same rule that keeps them off the leader card — so a short season can have
 * fewer than three, or none, and the post says so. First place is the
 * Player of the Season (seasonAwards). `points` carries the rating.
 */
export function seasonPodium(players: any[], matches: any[], season: Pick<Season, "startsOn" | "endsOn" | "endedAt">, minGames = 1): PodiumPlace[] {
  const ms = seasonMatches(matches, season);
  // Judged as at the season's last match, not today: the ± grows while
  // nobody plays, and weeks of quiet after the final day must not turn the
  // season's best player provisional after the fact.
  const last = ms.reduce((t, x) => Math.max(t, x.date || 0), 0);
  const st = glickoStandings(players, ms, { minGames, now: last || (season.endedAt ?? Date.now()) });
  return Object.keys(st.place)
    .filter((id) => st.place[id] <= 3)
    .map((id) => ({ playerId: id, place: st.place[id], points: st.table.rating[id], played: st.played[id] || 0 }))
    .sort((a, b) => a.place - b.place || b.points - a.points);
}

/**
 * The announcement posted when a season closes. One sentence for the
 * season, one per competition that has a winner; names as given.
 */
export function seasonClosedPost(seasonName: string, podium: Array<{ name: string; place: number }>, competitionWinners: Array<{ competition: string; name: string }>): string {
  const ord = (n: number) => (n === 1 ? "Player of the Season" : n === 2 ? "2nd" : "3rd");
  const parts = [`${seasonName} is over.`];
  if (podium.length) parts.push(podium.map((p) => `${ord(p.place)}: ${p.name}`).join(" · ") + ".");
  else parts.push("Nobody played enough to be placed, so there is no Player of the Season.");
  for (const c of competitionWinners) parts.push(`${c.competition}: ${c.name}.`);
  return parts.join(" ");
}
