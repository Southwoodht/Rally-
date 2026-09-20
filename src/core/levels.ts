import { LEVELS, SUBS } from "./constants";

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
 *
 * Since 2026-09-20 there is one other thing it will read: a level timeline a
 * league owner or editor filled in for somebody who never did. That is still
 * a recorded answer rather than a guessed one — somebody who knows the club
 * wrote it down, it is stored in its own columns, it is labelled as theirs
 * rather than the player’s, and the player’s own timeline overrides it the
 * instant they set one. What has not changed is that null is still a real
 * answer and still means nobody has said: with no timeline and no estimate,
 * every caller drops the level term rather than substituting a number for it.
 */
export function levelAt(player, ts) {
  const hist = timelineFor(player);
  if (!hist || !hist.length) return null;
  const d = new Date(ts);
  const at = d.getFullYear() * 12 + d.getMonth();
  const per = hist.find((p) => at >= monthIndex(p.from, false) && at <= monthIndex(p.to, true));
  return per ? { cat: per.cat, sub: per.sub } : null;
}

/**
 * Whose timeline to read: theirs, or their league admin’s estimate of it.
 *
 * Theirs wins outright and is never merged with the estimate. Merging would
 * build a timeline neither person ever described — their own 2019 entry
 * against an admin’s guess at 2024, with a hole between the two that reads as
 * "not recorded" — and afterwards nobody could say which half came from
 * where. One source or the other.
 *
 * An empty array counts as nothing said, the same as a missing one: clearing
 * your timeline should hand the question back to the estimate rather than pin
 * you at "no level" for good.
 */
function timelineFor(player) {
  if (!player) return null;
  if (player.levelHistory && player.levelHistory.length) return player.levelHistory;
  return player.levelEstimateHistory && player.levelEstimateHistory.length ? player.levelEstimateHistory : null;
}

/** Did this come from them or from their admin? For labelling, never for maths. */
export const levelIsEstimated = (player) => !!player && !player.level && !!player.levelEstimate;

export const timelineIsEstimated = (player) =>
  !!player && !(player.levelHistory && player.levelHistory.length) && !!(player.levelEstimateHistory && player.levelEstimateHistory.length);

/**
 * Their level today — the dropdown they picked, not the timeline.
 *
 * A prediction about a match nobody has played yet, or a sort of who is
 * strongest right now, is asking about the present, and the present is the
 * one date the current claim is actually evidence for. These call sites read
 * as levelAt(player, Date.now()) and were never really date queries at all.
 */
export const levelNow = (player) => (player ? (player.level || player.levelEstimate || null) : null);

/**
 * Their own claim only, with no admin estimate behind it.
 *
 * For the two places where the difference is the whole point: the form where
 * somebody picks their own level — pre-filling that with an admin’s guess
 * would turn the guess into their claim the moment they saved anything else —
 * and the prompt asking people to re-pick, which has to keep asking somebody
 * whose level was filled in for them.
 */
export const levelClaimed = (player) => (player ? (player.level || null) : null);

/** Have THEY set a timeline — an admin estimate deliberately does not count. */
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
