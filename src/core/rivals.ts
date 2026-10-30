import { countsAsPlayed, isLegacy } from "./matchStatus";

/**
 * Who goes on the profile's Rivals card (Sam, 2026-10-30).
 *
 * The NEMESIS is whoever has the best record AGAINST this player — the most
 * net wins over them (their wins minus the player's), across at least two
 * matches. Not the person they have lost to most: Sam lost to Charlie Easey
 * six times and leads him 11-3-6, and a man you beat eleven times is not
 * your nemesis. Nobody with a winning record over them, no nemesis.
 *
 * The RIVALS are the people they have played most, most matches first, then
 * the closer record.
 */
export interface H2HRecord { id: string; w: number; d: number; l: number }

/** At least this many matches before a record can make someone a nemesis. */
export const NEMESIS_MIN_MATCHES = 2;

export function pickNemesis(records: H2HRecord[]): H2HRecord | null {
  let best: H2HRecord | null = null;
  for (const r of records) {
    const net = r.l - r.w;
    if (net <= 0 || r.w + r.d + r.l < NEMESIS_MIN_MATCHES) continue;
    if (!best) { best = r; continue; }
    const bestNet = best.l - best.w;
    if (net > bestNet || (net === bestNet && r.w + r.d + r.l > best.w + best.d + best.l)) best = r;
  }
  return best;
}

export function topRivals(records: H2HRecord[], n = 3): H2HRecord[] {
  return [...records]
    .filter((r) => r.w + r.d + r.l > 0)
    .sort((a, b) => (b.w + b.d + b.l) - (a.w + a.d + a.l) || Math.abs(a.w - a.l) - Math.abs(b.w - b.l))
    .slice(0, n);
}

/**
 * Ahead / level / behind for every player, counting PEOPLE — the profile
 * hero's numbers, for the Table's rows (Sam, 2026-10-30). Counted exactly
 * as the profile counts them, or the row and the profile disagree (they
 * did: 9 on the Table, 10 on Sam's profile): matches that count, and for
 * somebody you have only ever met in legacy years, those legacy results.
 * Legacy never adds to a pair that has counted matches.
 */
export interface PeopleCount { ahead: number; level: number; behind: number }

export function peopleCounts(matches: { p1: string; p2: string; winner: string; status?: string }[]): Record<string, PeopleCount> {
  type Tally = { net: number; n: number };
  const live: Record<string, Record<string, Tally>> = {};
  const old: Record<string, Record<string, Tally>> = {};
  const bump = (into: typeof live, a: string, b: string, d: number) => {
    const row = (into[a] = into[a] || {});
    const t = (row[b] = row[b] || { net: 0, n: 0 });
    t.net += d; t.n++;
  };
  for (const m of matches) {
    if (!m.p1 || !m.p2 || m.p1 === m.p2) continue;
    const into = countsAsPlayed(m) ? live : isLegacy(m) ? old : null;
    if (!into) continue;
    const d = m.winner === "p1" ? 1 : m.winner === "p2" ? -1 : 0;
    bump(into, m.p1, m.p2, d);
    bump(into, m.p2, m.p1, -d);
  }
  const out: Record<string, PeopleCount> = {};
  for (const id of new Set([...Object.keys(live), ...Object.keys(old)])) {
    const c = { ahead: 0, level: 0, behind: 0 };
    for (const opp of new Set([...Object.keys(live[id] || {}), ...Object.keys(old[id] || {})])) {
      const t = live[id]?.[opp]?.n ? live[id][opp] : old[id]?.[opp];
      if (!t) continue;
      if (t.net > 0) c.ahead++; else if (t.net < 0) c.behind++; else c.level++;
    }
    out[id] = c;
  }
  return out;
}

/** "4–1": people ahead of, then people behind (Sam's own examples), with
 *  " · 1 level" after when there is one. */
export function peopleLine(c: PeopleCount | undefined): string {
  if (!c || c.ahead + c.level + c.behind === 0) return "";
  return `${c.ahead}–${c.behind}` + (c.level ? ` · ${c.level} level` : "");
}
