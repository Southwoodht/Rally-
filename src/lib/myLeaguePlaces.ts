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

/**
 * One line per club for the landing page (Sam's mockup, 2026-10-24): "4th ·
 * 1463 · 5 days ago". Your place and rating from the same all-time Glicko
 * standings as above, so the landing page cannot disagree with the Table;
 * when you last played; and whether the club has any results at all.
 */
export interface ClubSummary {
  leagueId: string;
  place: number | null;
  rating: number | null;
  lastPlayed: number | null;
  clubMatches: number;
}

let summaryCache: { at: number; key: string; out: ClubSummary[] } | null = null;

export async function myClubSummaries(leagues: Array<{ id: string }>, authId: string | null, now = Date.now()): Promise<ClubSummary[]> {
  if (!authId || !leagues || !leagues.length) return [];
  const key = authId + "|" + leagues.map((g) => g.id).sort().join(",");
  if (summaryCache && summaryCache.key === key && now - summaryCache.at < CACHE_MS) return summaryCache.out;

  const out: ClubSummary[] = [];
  await Promise.all(leagues.map(async (g) => {
    try {
      const data = await fetchLeagueData(g.id);
      const played = data.matches.filter((m: any) => countsAsPlayed(m));
      const me = data.players.find((p: any) => p.auth_id === authId);
      let place: number | null = null;
      let rating: number | null = null;
      let lastPlayed: number | null = null;
      if (me) {
        const cutoff = now - 365 * 86400000;
        const recent = new Set<string>();
        played.forEach((m: any) => { if (m.date >= cutoff) { recent.add(m.p1); recent.add(m.p2); } });
        const st = glickoStandings(data.players, data.matches, {
          minGames: PROVISIONAL_GAMES, now,
          eligible: (id) => recent.has(id) && !data.players.find((p: any) => p.id === id)?.inactive,
        });
        place = st.place[me.id] ?? null;
        rating = st.table.rating[me.id] != null ? Math.round(st.table.rating[me.id]) : null;
        for (const m of played) if ((m.p1 === me.id || m.p2 === me.id) && (!lastPlayed || m.date > lastPlayed)) lastPlayed = m.date;
      }
      out.push({ leagueId: g.id, place, rating, lastPlayed, clubMatches: played.length });
    } catch {
      // A club that will not load just shows its plain line.
    }
  }));
  summaryCache = { at: now, key, out };
  return out;
}

/** "today", "yesterday", "5 days ago", "3 weeks ago", "4 months ago". */
export function playedAgo(ts: number, now = Date.now()): string {
  const days = Math.floor((now - ts) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return days + " days ago";
  if (days < 60) return Math.round(days / 7) + " weeks ago";
  if (days < 730) return Math.round(days / 30) + " months ago";
  return Math.round(days / 365) + " years ago";
}
