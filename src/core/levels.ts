import { LEVELS, SUBS } from "@/core/constants";

export function levelVal(lv) { if (!lv) return null; const ci = LEVELS.indexOf(lv.cat), si = SUBS.indexOf(lv.sub); if (ci < 0 || si < 0) return null; return ci * 3 + si; }

// A timeline boundary is either a plain year number (older entries, and
// still what onboarding's quick "block size" setup writes) or a "YYYY-MM"
// string from the month-precision timeline editor. Both normalize to a
// single monotonic month index so levelAt can compare them uniformly. A
// bare year, treated as a boundary, spans the whole year (Jan as a start,
// Dec as an end) so legacy entries keep behaving exactly as before.
function monthIndex(v: any, asEnd: boolean): number {
  if (v == null) return asEnd ? Infinity : -Infinity;
  if (typeof v === "number") return asEnd ? v * 12 + 11 : v * 12;
  const [y, m] = String(v).split("-").map(Number);
  return (y || 0) * 12 + ((m || 1) - 1);
}

// The plain year out of either boundary format — for contexts (like "N
// years playing") that only ever needed a year, never full month
// precision.
export const yearOf = (v: any): number | null => (v == null ? null : typeof v === "number" ? v : parseInt(String(v).split("-")[0], 10));

// A sortable key for a period's start, mixing legacy years and "YYYY-MM"
// strings safely — plain `a.from - b.from` breaks the moment either side
// is a month string (NaN), which is exactly the mix a migrated timeline
// now has.
export const startIndex = (v: any): number => monthIndex(v, false);

export function levelAt(player, ts) {
  if (player && player.levelHistory && player.levelHistory.length) {
    const d = new Date(ts);
    const at = d.getFullYear() * 12 + d.getMonth();
    const per = player.levelHistory.find((p) => at >= monthIndex(p.from, false) && at <= monthIndex(p.to, true));
    return per ? { cat: per.cat, sub: per.sub } : null;
  }
  return player ? (player.level || null) : null;
}

export const isSetUp = (p) => !!(p && p.levelHistory && p.levelHistory.length);
