import { LEVELS, SUBS } from "@/core/constants";

// A level as a star rating.
//
// One star per tier, filled in thirds by sub-level. Six tiers times three
// sub-levels is eighteen grades, six stars times three thirds is eighteen
// positions, so every grade in the system gets its own mark and nothing
// collides.
//
//   Beginner/Low        one third of the first star
//   Beginner/High       one full star — the tier is complete
//   Intermediate/Low    two full stars and a third
//   Pro/High            six full stars
//
// WENT TO FIVE AND CAME BACK, 2026-09-22 to 2026-09-23. Worth recording,
// because both decisions were Sam's and the second one is better informed
// than the first.
//
// He briefed category-only on a five-star scale after seeing 2.5 stars beside
// "Intermediate · Low", and the argument for it was sound and is matchGrade's:
// a sub-level is a dropdown and half of them are wrong, so ranking
// Intermediate/High above Intermediate/Medium is arithmetic on a guess.
//
// Then he saw it. "The stars have gone down to 5??? I was 2 and a third. Now
// I'm 3 full??" — and that is the part nobody reasoned about beforehand. It
// did not just simplify the badge, it INFLATED it. Intermediate was 2.33 of 6,
// which is 39% of the scale; as 3 of 5 it became 60%. Every player in the app
// moved up without playing anybody, and Beginner/Low and Beginner/High became
// the same picture.
//
// So: back to six in thirds, at his word. The dropdown objection still stands
// and is still true — it is simply a smaller cost than a scale that flatters
// everyone, and the place it gets paid is one third of one star.
//
// The formula reads better than it looks: levelVal is 0-17, and adding one
// before dividing is what makes Beginner/Low a third of a star rather than
// nothing at all. Somebody who has picked the lowest level has still picked
// one, and an empty row of stars is what "no level set" means.

/**
 * How many stars, in thirds. A third up to six, or null when no level is set.
 *
 * Null is not zero. Somebody who has never picked a level has not declared
 * themselves the weakest player in the league, and an empty row of outlines
 * says exactly that; a zero would be a claim they never made.
 */
export function starsForLevel(level: { cat?: string; sub?: string } | null | undefined): number | null {
  const v = levelValOf(level);
  return v === null ? null : (v + 1) / 3;
}

/** One star per tier. Six of them, because there are six tiers — tying it to
 *  LEVELS is what stops the two drifting apart. */
export const STAR_COUNT = LEVELS.length;

function levelValOf(level: { cat?: string; sub?: string } | null | undefined): number | null {
  if (!level || !level.cat || !level.sub) return null;
  const ci = LEVELS.indexOf(level.cat);
  const si = SUBS.indexOf(level.sub);
  if (ci < 0 || si < 0) return null;
  return ci * 3 + si;
}

/** Bars in the profile's form strip, tallest first. */
export const TIER_HEIGHTS: Record<string, number> = {
  Beginner: 10,
  Amateur: 14,
  Intermediate: 18,
  Advanced: 22,
  "Semi-pro": 26,
  Pro: 30,
};

/**
 * How tall this opponent's bar is, or null when their level at that date
 * isn't recorded.
 *
 * Null has to survive all the way to the renderer. Two thirds of the league
 * have no level history at all, so falling back to today's level would
 * silently redraw somebody's 2019 form every time an opponent got promoted —
 * which is the one thing form is supposed to be immune to.
 */
export function tierHeight(level: { cat?: string } | null | undefined): number | null {
  if (!level || !level.cat) return null;
  const h = TIER_HEIGHTS[level.cat];
  return h === undefined ? null : h;
}

/** Every category, in order, for legends and pickers. */
export const TIERS = LEVELS.slice();
