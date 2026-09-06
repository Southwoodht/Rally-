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

/**
 * What somebody's level was on a given date, or **null** if nobody recorded
 * one covering it.
 *
 * It used to fall back to their level today when they had no history at all,
 * and that fallback was load-bearing in the worst way: fourteen of
 * Seacourt's twenty-one players have no history, so twenty-six of Sam's
 * forty-four matches were being graded against a level nobody ever claimed
 * for the year they were played. Worse, the fallback used the *current*
 * claim, so promoting somebody today silently reached back and rewrote what
 * their 2019 wins had been worth.
 *
 * Null is a real answer — "not recorded" — and every caller handles it
 * explicitly. Nothing may quietly substitute a number for it. In particular
 * `?? 0` is not handling it: zero is Beginner/Low, a claim in its own right
 * and a considerably stronger one than saying nothing.
 *
 * For "what are they now", which is a different question and has a real
 * answer for everybody, use levelNow.
 */
export function levelAt(player, ts) {
  if (!player || !player.levelHistory || !player.levelHistory.length) return null;
  const d = new Date(ts);
  const at = d.getFullYear() * 12 + d.getMonth();
  const per = player.levelHistory.find((p) => at >= monthIndex(p.from, false) && at <= monthIndex(p.to, true));
  return per ? { cat: per.cat, sub: per.sub } : null;
}

/**
 * Their level today — the dropdown they picked, not the timeline.
 *
 * A prediction about a match nobody has played yet, or a sort of who is
 * strongest right now, is asking about the present, and the present is the
 * one date the current claim is actually evidence for. These call sites read
 * as levelAt(player, Date.now()) and were never really date queries at all.
 */
export const levelNow = (player) => (player ? (player.level || null) : null);

export const isSetUp = (p) => !!(p && p.levelHistory && p.levelHistory.length);

// A month index back into a "YYYY-MM" boundary.
const monthLabel = (i: number): string => {
  const y = Math.floor(i / 12), m = (i % 12) + 1;
  return y + "-" + String(m).padStart(2, "0");
};

/**
 * Turn a list of "this level, effective from here" entries into the
 * from/to periods levelAt reads.
 *
 * People know when they moved up. They do not know, and should not have to
 * say, when the previous level ended — it ended when the next one started,
 * and asking twice is how you get a timeline with a hole in it that reads
 * as "not recorded" for the months nobody thought about. So the editor
 * collects starts only and the ends are derived here: each period runs to
 * the month before the next one begins, and the last runs to null, meaning
 * now.
 *
 * Entries arrive in any order and come back sorted.
 */
export function sealTimeline(periods: any[]): any[] {
  const sorted = [...(periods || [])].sort((a, b) => startIndex(a.from) - startIndex(b.from));
  return sorted.map((p, i) => {
    const next = sorted[i + 1];
    if (!next) return { ...p, to: null };
    return { ...p, to: monthLabel(startIndex(next.from) - 1) };
  });
}
