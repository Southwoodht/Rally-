import { countsAsPlayed } from "@/core/matchStatus";
import { glickoStandings } from "@/core/glicko";
import { fetchLeagueData } from "@/lib/leagueData";
import { PROVISIONAL_GAMES } from "@/lib/globalTable";

export interface LeaguePlace {
  leagueId: string;
  name: string;
  place: number;
  of: number;
  /** The Glicko rating, rounded — the same number that club's table prints all time. */
  rating: number;
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
      // The same glickoStandings the Home card uses, on that club's all-time
      // view (active players, 5 matches, the ± line): one ranking since
      // 2026-10-22, so the place here is the place on that club's Table.
      const cutoff = now - 365 * 86400000;
      const recent = new Set<string>();
      data.matches.forEach((m: any) => { if (countsAsPlayed(m) && m.date >= cutoff) { recent.add(m.p1); recent.add(m.p2); } });
      const st = glickoStandings(data.players, data.matches, {
        minGames: PROVISIONAL_GAMES, now,
        eligible: (id) => recent.has(id) && !data.players.find((p: any) => p.id === id)?.inactive,
      });
      const place = st.place[me.id];
      if (place) places.push({ leagueId: g.id, name: g.name, place, of: st.of, rating: Math.round(st.table.rating[me.id]) });
    } catch {
      // A league that won't load is simply left off the list. A profile is
      // not worth failing over, and a half-loaded league would produce a
      // wrong place, which is worse than a missing one.
    }
  }
  cache = { at: now, key, places };
  return places;
}
