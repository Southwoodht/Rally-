import { computeStats } from "@/core/elo";
import { rankMaps } from "@/core/rank";
import { fetchLeagueData } from "@/lib/leagueData";

export interface LeaguePlace {
  leagueId: string;
  name: string;
  place: number;
  of: number;
}

// Where you sit in each of your own leagues, for the profile's details block:
// "#5 Seacourt, #4 Hayling".
//
// Deliberately computed by loading each league and running the same
// rankMaps() the league table itself runs, rather than reimplementing the
// ranking in SQL. Two copies of a ranking formula drift, and the day they do,
// the number on someone's profile stops matching the table they're looking
// at — which is worse than not showing it at all.
//
// Only ever called for your own profile. Other people's leagues aren't yours
// to load, and RLS would refuse anyway.

let cache: { at: number; key: string; places: LeaguePlace[] } | null = null;
const CACHE_MS = 120_000;

export async function myLeaguePlaces(groups: any[], authId: string | null, now = Date.now()): Promise<LeaguePlace[]> {
  if (!authId || !groups || !groups.length) return [];
  const key = authId + "|" + groups.map((g) => g.id).sort().join(",");
  if (cache && cache.key === key && now - cache.at < CACHE_MS) return cache.places;

  const places: LeaguePlace[] = [];
  for (const g of groups) {
    try {
      const data = await fetchLeagueData(g.id);
      const me = data.players.find((p: any) => p.auth_id === authId);
      if (!me) continue;
      const { elo, wdl } = computeStats(data.players, data.matches);
      const maps = rankMaps(data.players, data.matches, elo, wdl);
      const place = maps.off[me.id];
      if (place) places.push({ leagueId: g.id, name: g.name, place, of: Object.keys(maps.off).length });
    } catch {
      // A league that won't load is simply left off the list. A profile is
      // not worth failing over, and a half-loaded league would produce a
      // wrong place, which is worse than a missing one.
    }
  }
  cache = { at: now, key, places };
  return places;
}
