import { computeStats } from "./elo";
import { countsAsPlayed } from "./matchStatus";
import { computeOfficial } from "./official";

/**
 * What each result did to Official points (Sam, 2026-10-22: "show its real
 * change in Official points, not Elo, so the numbers add up to the table").
 *
 * Official is not a running total: it is recomputed from every result at
 * once, because an opponent's strength comes from their whole record. So the
 * club's history is replayed one match at a time, Official is worked out
 * after each, and a match's number is the difference it made — to the two
 * who played it, and also, by a little, to everybody else, since the two
 * players' strengths moved and those are the opponents other people's
 * results are weighed against.
 *
 * That second part is why a player's own numbers do not add up to their
 * Official on their own, and why `others` exists: own matches + others =
 * Official, exactly. On Seacourt's real export others ran from 0 to +7
 * (Zaach), so it is shown, not hidden.
 *
 * Same rules as the table: countsAsPlayed (so unconfirmed results count, as
 * they do there), every player in the list, and a player with no games at 0
 * rather than the table's −1,000,000 sentinel.
 */
export interface OfficialTimeline {
  /** match id → player id → the change that match made to them. */
  perMatch: Record<string, Record<string, number>>;
  /** player id → total change from matches they were not in. */
  others: Record<string, number>;
  /** player id → Official after everything (0 when no games). */
  final: Record<string, number>;
}

const value = (o: Record<string, number>, id: string) => (o[id] > -1e5 ? o[id] : 0);

export function officialTimeline(players: any[], matches: any[]): OfficialTimeline {
  const ms = matches
    .filter((m) => countsAsPlayed(m))
    .sort((a, b) => a.date - b.date || (a.loggedAt ?? 0) - (b.loggedAt ?? 0) || String(a.id).localeCompare(String(b.id)));
  const perMatch: OfficialTimeline["perMatch"] = {};
  const others: Record<string, number> = {};
  const startStats = computeStats(players, []);
  const start = computeOfficial(players, [], startStats.wdl);
  let prev: Record<string, number> = {};
  players.forEach((p) => { prev[p.id] = value(start, p.id); others[p.id] = 0; });

  for (let k = 0; k < ms.length; k++) {
    const upto = ms.slice(0, k + 1);
    const stats = computeStats(players, upto);
    const o = computeOfficial(players, upto, stats.wdl);
    const m = ms[k];
    const row: Record<string, number> = {};
    const next: Record<string, number> = {};
    for (const p of players) {
      next[p.id] = value(o, p.id);
      const d = next[p.id] - prev[p.id];
      if (p.id === m.p1 || p.id === m.p2) row[p.id] = d;
      else others[p.id] += d;
    }
    perMatch[m.id] = row;
    prev = next;
  }
  // A carried-in record (onboarding) is Official before any match here; it
  // goes in `others` so the three numbers still add up.
  players.forEach((p) => { others[p.id] += value(start, p.id); });
  return { perMatch, others, final: prev };
}
