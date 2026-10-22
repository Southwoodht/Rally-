/**
 * Season honours: what a finished season gave each player, worked out from
 * the results rather than stored.
 *
 * Sam, 2026-10-22: at the end of a season, division winners and the Player
 * of the Season should get a trophy on their profile "with no admin". Stored
 * trophies would need a club admin's permission at the exact moment some
 * member's app happened to close the season, and a corrected result would
 * leave a wrong trophy behind. Derived, they need nobody, cannot disagree
 * with the results, and a season or division that is removed takes its
 * honours with it — the same rule as every table in the app.
 *
 *   - Player of the Season: first place on the season's podium (the Table's
 *     Glicko, established players only; core/seasonStandings.ts). Shared if
 *     two are genuinely level.
 *   - Division / competition winner: first place in each league-format
 *     competition that belonged to the season, with a match played.
 *
 * Only ENDED seasons give honours: a running season's leader has won nothing
 * yet.
 *
 * Pure: no React, no Supabase.
 */
import { leagueTable, type Competition, type CompetitionPair, type CompetitionResult } from "./doubles/competition";
import { seasonPodium } from "./seasonStandings";
import type { Season } from "./seasons";

export interface SeasonHonour {
  /** Stable, for list keys: never a database id. */
  id: string;
  playerId: string;
  competition: string;
  result: string;
  season: string;
  /** The season's last day, "YYYY-MM-DD", which places it in match history. */
  wonOn: string | null;
  format: "singles" | "doubles";
}

export function seasonHonours(input: {
  players: any[];
  matches: any[];
  seasons: Season[];
  competitions: Competition[];
  entries: CompetitionPair[];
  resultsOf: (c: Competition) => CompetitionResult[];
  minGames: number;
}): SeasonHonour[] {
  const out: SeasonHonour[] = [];
  for (const s of input.seasons) {
    if (s.status !== "ended") continue;
    const day = s.endsOn ?? (s.endedAt ? new Date(s.endedAt).toISOString().slice(0, 10) : null);
    for (const p of seasonPodium(input.players, input.matches, s, input.minGames)) {
      if (p.place !== 1) continue;
      out.push({ id: `pos:${s.id}:${p.playerId}`, playerId: p.playerId, competition: "Player of the Season", result: "Winner", season: s.name, wonOn: day, format: "singles" });
    }
    for (const c of input.competitions) {
      if (c.seasonId !== s.id || c.format !== "league") continue;
      const entries = input.entries.filter((e) => e.competitionId === c.id);
      const top = leagueTable(entries, input.resultsOf(c), c.pointsWin, c.pointsDraw).filter((r) => r.place === 1 && r.played > 0);
      for (const r of top) {
        const e = entries.find((x) => x.id === r.pairId);
        if (!e) continue;
        for (const pid of [e.p1, e.p2]) {
          if (!pid) continue;
          out.push({ id: `div:${c.id}:${pid}`, playerId: pid, competition: c.name, result: "Winner", season: s.name, wonOn: day, format: c.kind === "doubles" ? "doubles" : "singles" });
        }
      }
    }
  }
  return out;
}
