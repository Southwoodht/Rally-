/**
 * A record per calendar year, for the year headers on match history.
 *
 * Sam, 14 Oct 2026: "on match history can u add the years just so i can see
 * my patterns". A list of dates says when; a header that says "2025 ·
 * 14–3–6 · 67%" says how that year went, and stacked down the page the
 * headers ARE the pattern.
 *
 * Unconfirmed results are left out of the count, as they are from every
 * number in the engine: the header sits over the rows, and if it counted a
 * win nobody has agreed to it would disagree with the record tile above it.
 * The rows still list them, marked.
 *
 * Years are the calendar year in UK time, the same clock every date in the
 * app is printed on.
 */
export interface YearRecord { w: number; d: number; l: number; played: number; pct: number }

export const yearOf = (ts: number): number =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric" }).format(new Date(ts)));

export function recordsByYear(rows: Array<{ date: number; outcome: "W" | "D" | "L"; pending?: boolean; legacy?: boolean }>): Record<number, YearRecord> {
  const out: Record<number, YearRecord> = {};
  for (const r of rows) {
    // A legacy result sits under its year but never in the year's record:
    // the record is rated matches only.
    if (r.pending || r.legacy) continue;
    const y = yearOf(r.date);
    const rec = out[y] || (out[y] = { w: 0, d: 0, l: 0, played: 0, pct: 0 });
    if (r.outcome === "W") rec.w++; else if (r.outcome === "D") rec.d++; else rec.l++;
    rec.played++;
  }
  for (const y of Object.keys(out)) {
    const r = out[+y];
    // Wins over matches played: "% won" means exactly that (2026-10-25:
    // draws at half put 71% beside a profile reading 65%).
    r.pct = r.played ? Math.round((r.w / r.played) * 100) : 0;
  }
  return out;
}
