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
 * Ahead / level / behind for every player in a match list, counting PEOPLE
 * — the profile hero's numbers, for the Table's rows (Sam, 2026-10-30:
 * "under people it says their head to head not their records"). Pass only
 * matches that count; a draw-only record against somebody is level.
 */
export interface PeopleCount { ahead: number; level: number; behind: number }

export function peopleCounts(matches: { p1: string; p2: string; winner: string }[]): Record<string, PeopleCount> {
  const net: Record<string, Record<string, number>> = {};
  const bump = (a: string, b: string, n: number) => {
    const row = (net[a] = net[a] || {});
    row[b] = (row[b] || 0) + n;
  };
  for (const m of matches) {
    if (!m.p1 || !m.p2 || m.p1 === m.p2) continue;
    const d = m.winner === "p1" ? 1 : m.winner === "p2" ? -1 : 0;
    bump(m.p1, m.p2, d);
    bump(m.p2, m.p1, -d);
  }
  const out: Record<string, PeopleCount> = {};
  for (const id of Object.keys(net)) {
    const c = { ahead: 0, level: 0, behind: 0 };
    for (const n of Object.values(net[id])) { if (n > 0) c.ahead++; else if (n < 0) c.behind++; else c.level++; }
    out[id] = c;
  }
  return out;
}
