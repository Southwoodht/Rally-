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
 * One player's record against everybody else in a match list — for the
 * tables, which say under each name how YOU stand against them (Sam,
 * 2026-10-30: "under people it says their head to head not their
 * records"). Pass only matches that count.
 */
export function recordsVs(matches: { p1: string; p2: string; winner: string }[], me: string): Record<string, { w: number; d: number; l: number }> {
  const out: Record<string, { w: number; d: number; l: number }> = {};
  for (const m of matches) {
    if (m.p1 !== me && m.p2 !== me) continue;
    const opp = m.p1 === me ? m.p2 : m.p1;
    if (!opp || opp === me) continue;
    const r = (out[opp] = out[opp] || { w: 0, d: 0, l: 0 });
    if (m.winner === "draw") r.d++;
    else if ((m.winner === "p1") === (m.p1 === me)) r.w++;
    else r.l++;
  }
  return out;
}

/** "You lead 3–1", "You trail 1–4", "Level 2–2", "Never played you". */
export function vsLine(r: { w: number; d: number; l: number } | undefined): string {
  if (!r || r.w + r.d + r.l === 0) return "Never played you";
  const rec = r.d ? `${r.w}–${r.d}–${r.l}` : `${r.w}–${r.l}`;
  return (r.w > r.l ? "You lead " : r.w < r.l ? "You trail " : "Level ") + rec;
}
